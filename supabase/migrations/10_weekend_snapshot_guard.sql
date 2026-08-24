begin;

create or replace function public.reject_non_weekend_window_snapshot(p_window_id uuid)
returns void
language plpgsql
as $$
begin
  if exists (
    select 1
    from selection_window_eligible_fixtures swef
    left join season_fixtures sf on sf.id = swef.season_fixture_id
    where swef.window_id = p_window_id
      and public.london_isodow(swef.kickoff_at) not in (6, 7)
      and coalesce(sf.eligibility_override, 'none') <> 'force_eligible'
  ) then
    raise exception 'NON_WEEKEND_FIXTURES';
  end if;
end;
$$;

create or replace function public.admin_rebuild_open_weekend_snapshot(p_window_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window selection_windows%rowtype;
  v_pick_count int;
  v_fixture_count int;
  v_earliest timestamptz;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select * into v_window from selection_windows where id = p_window_id;
  if v_window.id is null then
    raise exception 'WINDOW_NOT_FOUND';
  end if;

  if v_window.window_number < 2 then
    raise exception 'WINDOW_1_PROTECTED';
  end if;

  if v_window.status not in ('open', 'pending') then
    raise exception 'WINDOW_NOT_CORRECTABLE';
  end if;

  select count(*) into v_pick_count
  from selections
  where window_id = p_window_id
    and team_id is not null;

  if v_pick_count > 0 then
    raise exception 'WINDOW_HAS_PICKS';
  end if;

  if v_window.eligible_sat_date is null or v_window.eligible_sun_date is null then
    raise exception 'WEEKEND_DATES_MISSING';
  end if;

  delete from selection_window_eligible_fixtures where window_id = p_window_id;

  insert into selection_window_eligible_fixtures (
    window_id, season_fixture_id, home_team_id, away_team_id,
    home_team_name, away_team_name, kickoff_at, snapshot_kickoff_at, fixture_status
  )
  select
    p_window_id,
    sf.id,
    sf.home_team_id,
    sf.away_team_id,
    ht.name,
    at.name,
    sf.kickoff_at,
    sf.kickoff_at,
    sf.status
  from season_fixtures sf
  join teams ht on ht.id = sf.home_team_id
  join teams at on at.id = sf.away_team_id
  where sf.season = (select season from games where id = v_window.game_id)
    and public.london_date(sf.kickoff_at) between v_window.eligible_sat_date and v_window.eligible_sun_date
    and public.is_standard_eligible_fixture(sf.kickoff_at, sf.eligibility_override, sf.status);

  perform public.reject_non_weekend_window_snapshot(p_window_id);

  select count(*), min(kickoff_at)
    into v_fixture_count, v_earliest
  from selection_window_eligible_fixtures
  where window_id = p_window_id;

  if v_fixture_count is null or v_fixture_count < 1 then
    raise exception 'NO_ELIGIBLE_FIXTURES';
  end if;

  update selection_windows
  set earliest_kickoff_at = v_earliest,
      updated_at = now()
  where id = p_window_id;

  return jsonb_build_object(
    'result', 'rebuilt',
    'window_id', p_window_id,
    'fixture_count', v_fixture_count,
    'earliest_kickoff_at', v_earliest,
    'deadline_at', v_window.deadline_at
  );
end;
$$;

grant execute on function public.admin_rebuild_open_weekend_snapshot(uuid) to authenticated;

create or replace function public.admin_open_next_round(
  p_current_window_id uuid,
  p_sat date,
  p_sun date,
  p_deadline timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_current selection_windows%rowtype;
  v_existing selection_windows%rowtype;
  v_new selection_windows%rowtype;
  v_next_number int;
  v_survivors int;
  v_fixture_count int;
  v_earliest timestamptz;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select id into v_actor from players where user_id = auth.uid();
  if v_actor is null then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  select * into v_current from selection_windows where id = p_current_window_id;
  if v_current.id is null then
    raise exception 'WINDOW_NOT_FOUND';
  end if;

  if v_current.window_number < 2 then
    raise exception 'WINDOW_1_PROTECTED';
  end if;

  if v_current.status <> 'resolved' then
    raise exception 'CURRENT_ROUND_NOT_RESOLVED';
  end if;

  select * into v_existing
  from selection_windows
  where game_id = v_current.game_id
    and window_number >= 2
    and window_number > v_current.window_number
    and status in ('open', 'locked', 'resolving')
  order by window_number desc
  limit 1;

  if found then
    return jsonb_build_object(
      'result', 'already_open',
      'window_id', v_existing.id,
      'window_number', v_existing.window_number,
      'deadline_at', v_existing.deadline_at
    );
  end if;

  select * into v_existing
  from selection_windows
  where game_id = v_current.game_id
    and window_number >= 2
    and eligible_sat_date = p_sat
    and eligible_sun_date = p_sun
    and status in ('pending', 'open', 'locked', 'resolving')
  limit 1;

  if found then
    return jsonb_build_object(
      'result', 'already_open',
      'window_id', v_existing.id,
      'window_number', v_existing.window_number,
      'deadline_at', v_existing.deadline_at
    );
  end if;

  select count(*) into v_survivors
  from game_entries
  where game_id = v_current.game_id
    and paid
    and status = 'active';

  if v_survivors < 1 then
    raise exception 'NO_SURVIVORS';
  end if;

  select coalesce(max(window_number), 1) + 1 into v_next_number
  from selection_windows
  where game_id = v_current.game_id;

  if v_next_number < 2 then
    v_next_number := 2;
  end if;

  insert into selection_windows (
    game_id, window_number, status,
    eligible_sat_date, eligible_sun_date,
    deadline_at, start_at, end_at
  )
  values (
    v_current.game_id,
    v_next_number,
    'pending',
    p_sat,
    p_sun,
    p_deadline,
    p_deadline - interval '2 days',
    p_deadline + interval '4 days'
  )
  returning * into v_new;

  perform public.refresh_pending_window_snapshots(v_new.id);

  begin
    perform public.reject_non_weekend_window_snapshot(v_new.id);
  exception
    when others then
      delete from selection_window_eligible_fixtures where window_id = v_new.id;
      delete from selection_windows where id = v_new.id and status = 'pending' and window_number >= 2;
      raise exception 'NON_WEEKEND_FIXTURES';
  end;

  select count(*), min(kickoff_at)
    into v_fixture_count, v_earliest
  from selection_window_eligible_fixtures
  where window_id = v_new.id;

  if v_fixture_count is null or v_fixture_count < 1 then
    delete from selection_windows where id = v_new.id and status = 'pending' and window_number >= 2;
    raise exception 'NO_ELIGIBLE_FIXTURES';
  end if;

  update selection_windows
  set deadline_at = p_deadline,
      earliest_kickoff_at = v_earliest,
      start_at = p_deadline - interval '2 days',
      end_at = coalesce(v_earliest, p_deadline) + interval '2 days',
      status = 'open',
      approved_at = now(),
      approved_by_player_id = v_actor,
      review_outcome = null,
      updated_at = now()
  where id = v_new.id
  returning * into v_new;

  return jsonb_build_object(
    'result', 'opened',
    'window_id', v_new.id,
    'window_number', v_new.window_number,
    'fixture_count', v_fixture_count,
    'deadline_at', v_new.deadline_at,
    'sat', p_sat,
    'sun', p_sun,
    'survivor_count', v_survivors
  );
end;
$$;

grant execute on function public.admin_open_next_round(uuid, date, date, timestamptz) to authenticated;

commit;
