-- UK kickoff-day eligibility: Saturday/Sunday only from Europe/London kickoff.
-- Canonical-key date is a cross-check for stale placeholder kickoffs, not the sole source.
-- Does not change Round 1/2 outcomes, payments, pot, Window 1, or prior picks.

create or replace function public.canonical_key_london_isodow(p_canonical_key text)
returns int
language sql
immutable
as $$
  select case
    when p_canonical_key is null then null
    when split_part(p_canonical_key, '|', 4) ~ '^\d{4}-\d{2}-\d{2}$'
      then extract(isodow from split_part(p_canonical_key, '|', 4)::date)::int
    else null
  end;
$$;

create or replace function public.is_los_weekend_eligible(
  p_kickoff timestamptz,
  p_override text,
  p_status fixture_status,
  p_canonical_key text
)
returns boolean
language sql
immutable
as $$
  select
    p_kickoff is not null
    and p_status in ('scheduled', 'in_play')
    and coalesce(p_override, 'none') is distinct from 'force_ineligible'
    and (
      p_override = 'force_eligible'
      or (
        coalesce(p_override, 'none') in ('none', '')
        and public.london_isodow(p_kickoff) in (6, 7)
        and (
          public.canonical_key_london_isodow(p_canonical_key) is null
          or public.canonical_key_london_isodow(p_canonical_key) in (6, 7)
        )
      )
    );
$$;

create or replace function public.is_standard_eligible_fixture(
  p_kickoff timestamptz,
  p_override text,
  p_status fixture_status
)
returns boolean
language sql
immutable
as $$
  select public.is_los_weekend_eligible(p_kickoff, p_override, p_status, null);
$$;

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
      and not public.is_los_weekend_eligible(
        coalesce(sf.kickoff_at, swef.kickoff_at),
        coalesce(sf.eligibility_override, 'none'),
        coalesce(sf.status, swef.fixture_status),
        sf.canonical_key
      )
  ) then
    raise exception 'NON_WEEKEND_FIXTURES';
  end if;
end;
$$;

create or replace function public.refresh_pending_window_snapshots(p_window_id uuid)
returns void as $$
declare
  v_window selection_windows%rowtype;
begin
  select * into v_window from selection_windows where id = p_window_id;
  if v_window.id is null or v_window.status <> 'pending' or v_window.window_number < 2 then
    return;
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
    and public.is_los_weekend_eligible(sf.kickoff_at, sf.eligibility_override, sf.status, sf.canonical_key);

  select min(kickoff_at) into v_window.earliest_kickoff_at
  from selection_window_eligible_fixtures where window_id = p_window_id;

  if v_window.earliest_kickoff_at is not null then
    update selection_windows
    set
      earliest_kickoff_at = v_window.earliest_kickoff_at,
      deadline_at = v_window.earliest_kickoff_at - interval '1 hour',
      start_at = v_window.earliest_kickoff_at - interval '2 days',
      end_at = v_window.earliest_kickoff_at + interval '2 days',
      updated_at = now()
    where id = p_window_id;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

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
    and public.is_los_weekend_eligible(sf.kickoff_at, sf.eligibility_override, sf.status, sf.canonical_key);

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

create or replace function public.admin_strip_non_weekend_snapshot_fixtures(p_window_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window selection_windows%rowtype;
  v_removed int := 0;
  v_remaining int := 0;
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

  if exists (
    select 1
    from selection_window_eligible_fixtures swef
    left join season_fixtures sf on sf.id = swef.season_fixture_id
    join selections s on s.window_id = p_window_id
      and s.team_id is not null
      and (
        s.season_fixture_id = swef.season_fixture_id
        or s.team_id in (swef.home_team_id, swef.away_team_id)
      )
    where swef.window_id = p_window_id
      and not public.is_los_weekend_eligible(
        coalesce(sf.kickoff_at, swef.kickoff_at),
        coalesce(sf.eligibility_override, 'none'),
        coalesce(sf.status, swef.fixture_status),
        sf.canonical_key
      )
  ) then
    raise exception 'WINDOW_HAS_PICKS_ON_INVALID';
  end if;

  delete from selection_window_eligible_fixtures swef
  using season_fixtures sf
  where swef.window_id = p_window_id
    and sf.id = swef.season_fixture_id
    and not public.is_los_weekend_eligible(
      coalesce(sf.kickoff_at, swef.kickoff_at),
      coalesce(sf.eligibility_override, 'none'),
      coalesce(sf.status, swef.fixture_status),
      sf.canonical_key
    );

  get diagnostics v_removed = row_count;

  select count(*) into v_remaining
  from selection_window_eligible_fixtures
  where window_id = p_window_id;

  return jsonb_build_object(
    'result', 'stripped',
    'window_id', p_window_id,
    'removed', v_removed,
    'remaining', v_remaining,
    'deadline_at', v_window.deadline_at
  );
end;
$$;

revoke all on function public.admin_strip_non_weekend_snapshot_fixtures(uuid) from public;
grant execute on function public.admin_strip_non_weekend_snapshot_fixtures(uuid) to authenticated;

-- Repair Ipswich Town v Liverpool to Friday 4 Sep 2026 20:00 BST (19:00 UTC).
-- Provider/canonical date already said Friday; stored kickoff was a Saturday 15:00 placeholder.
update public.season_fixtures
set kickoff_at = '2026-09-04T19:00:00Z',
    canonical_key = '2026/27|ips|liv|2026-09-04',
    updated_at = now()
where season = '2026/27'
  and home_team_id = 'ips'
  and away_team_id = 'liv'
  and id = 'd06d5d69-98d2-4eae-8d3e-2b0cf6595654';

-- Remove that Friday fixture from the current open Round 3 snapshot if nobody has picked Ipswich or Liverpool.
delete from public.selection_window_eligible_fixtures swef
using public.selection_windows sw
where swef.window_id = sw.id
  and sw.id = 'b675057f-7fd5-4ae7-8f4a-9c5d6deba31f'
  and sw.game_id = '8c656596-27c3-419e-98fe-7228724e84fe'
  and sw.window_number = 4
  and sw.status = 'open'
  and swef.home_team_id = 'ips'
  and swef.away_team_id = 'liv'
  and not exists (
    select 1
    from public.selections s
    where s.window_id = sw.id
      and s.team_id is not null
      and s.team_id in ('ips', 'liv')
  );
