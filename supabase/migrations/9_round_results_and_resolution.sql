-- Round result sync, resolution outcomes, and next-round opening.
-- Idempotent. Does not modify player identities, payments, pot, or Window 1 data.

begin;

alter table public.season_fixtures
  add column if not exists last_result_sync_at timestamptz,
  add column if not exists result_source text,
  add column if not exists provider_status text,
  add column if not exists result_match_method text;

alter table public.selections
  add column if not exists outcome text,
  add column if not exists outcome_reason text,
  add column if not exists used_final boolean not null default false,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by_player_id uuid references public.players(id);

do $$ begin
  alter table public.selections
    add constraint selections_outcome_check
    check (outcome is null or outcome in ('survived', 'eliminated', 'no_pick', 'pending'));
exception when duplicate_object then null;
end $$;

alter table public.selection_windows
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by_player_id uuid references public.players(id);

-- Finally used teams come from resolved / used_final picks only.
-- Deadline passing or lock is not a proxy for result resolution.
create or replace function public.is_team_finally_used(p_game_id uuid, p_player_id uuid, p_team_id text)
returns boolean as $$
  select exists (
    select 1
    from selections s
    join selection_windows sw on sw.id = s.window_id
    where s.game_id = p_game_id
      and s.player_id = p_player_id
      and s.team_id = p_team_id
      and s.team_id is not null
      and sw.window_number >= 2
      and (
        coalesce(s.used_final, false) = true
        or sw.status = 'resolved'
      )
  );
$$ language sql stable;

drop function if exists public.public_current_window_picks(uuid);

create or replace function public.public_current_window_picks(p_window_id uuid)
returns table (
  player_id uuid,
  display_name text,
  team_id text,
  locked_at timestamptz,
  updated_at timestamptz,
  admin_corrected boolean,
  outcome text,
  used_final boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.player_id,
    p.display_name,
    s.team_id,
    s.locked_at,
    s.updated_at,
    coalesce(s.admin_corrected, false) as admin_corrected,
    s.outcome,
    coalesce(s.used_final, false) as used_final
  from selections s
  join players p on p.id = s.player_id
  where s.window_id = p_window_id
    and s.team_id is not null
  order by p.display_name;
$$;

revoke all on function public.public_current_window_picks(uuid) from public;
grant execute on function public.public_current_window_picks(uuid) to anon, authenticated;

create or replace function public.admin_apply_round_resolution(p_window_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_window selection_windows%rowtype;
  v_now timestamptz := now();
  v_entry record;
  v_sel record;
  v_fix record;
  v_outcome text;
  v_reason text;
  v_survived int := 0;
  v_eliminated int := 0;
  v_no_pick int := 0;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select id into v_actor from players where user_id = auth.uid();
  if v_actor is null then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  select * into v_window from selection_windows where id = p_window_id;
  if v_window.id is null then
    raise exception 'WINDOW_NOT_FOUND';
  end if;

  if v_window.window_number < 2 then
    raise exception 'WINDOW_1_PROTECTED';
  end if;

  if v_window.status = 'resolved' then
    return jsonb_build_object(
      'result', 'already_resolved',
      'window_id', v_window.id,
      'window_number', v_window.window_number,
      'resolved_at', v_window.resolved_at
    );
  end if;

  if v_now < v_window.deadline_at then
    raise exception 'DEADLINE_NOT_PASSED';
  end if;

  for v_entry in
    select ge.*
    from game_entries ge
    where ge.game_id = v_window.game_id
      and ge.paid
      and ge.status = 'active'
  loop
    v_sel := null;
    v_fix := null;
    select * into v_sel
    from selections
    where window_id = p_window_id
      and player_id = v_entry.player_id;

    if found and v_sel.team_id is not null then
      select
        sf.status,
        sf.result_status,
        sf.home_score,
        sf.away_score,
        swef.home_team_id,
        swef.away_team_id
      into v_fix
      from selection_window_eligible_fixtures swef
      join season_fixtures sf on sf.id = swef.season_fixture_id
      where swef.window_id = p_window_id
        and (swef.home_team_id = v_sel.team_id or swef.away_team_id = v_sel.team_id)
      order by swef.kickoff_at
      limit 1;

      if not found
         or v_fix.status is distinct from 'finished'
         or v_fix.result_status is distinct from 'final'
         or v_fix.home_score is null
         or v_fix.away_score is null then
        raise exception 'UNRESOLVED_FIXTURES';
      end if;
    end if;
  end loop;

  update selection_windows
  set status = 'resolving', updated_at = v_now
  where id = p_window_id;

  for v_entry in
    select ge.*
    from game_entries ge
    where ge.game_id = v_window.game_id
      and ge.paid
      and ge.status = 'active'
  loop
    v_sel := null;
    v_fix := null;
    select * into v_sel
    from selections
    where window_id = p_window_id
      and player_id = v_entry.player_id;

    if not found or v_sel.team_id is null then
      v_outcome := 'no_pick';
      v_reason := 'no_pick';
      v_no_pick := v_no_pick + 1;

      insert into selections (
        game_id, window_id, player_id, team_id, season_fixture_id,
        outcome, outcome_reason, used_final, resolved_at, resolved_by_player_id
      ) values (
        v_window.game_id, p_window_id, v_entry.player_id, null, null,
        v_outcome, v_reason, false, v_now, v_actor
      )
      on conflict (window_id, player_id) do update set
        outcome = excluded.outcome,
        outcome_reason = excluded.outcome_reason,
        used_final = false,
        resolved_at = excluded.resolved_at,
        resolved_by_player_id = excluded.resolved_by_player_id,
        updated_at = now();

      update game_entries
      set status = 'eliminated',
          eliminated_reason = 'no_pick',
          updated_at = now()
      where id = v_entry.id
        and status = 'active';

      continue;
    end if;

    select
      sf.status,
      sf.result_status,
      sf.home_score,
      sf.away_score,
      swef.home_team_id,
      swef.away_team_id
    into v_fix
    from selection_window_eligible_fixtures swef
    join season_fixtures sf on sf.id = swef.season_fixture_id
    where swef.window_id = p_window_id
      and (swef.home_team_id = v_sel.team_id or swef.away_team_id = v_sel.team_id)
    order by swef.kickoff_at
    limit 1;

    if v_fix.home_score = v_fix.away_score then
      v_outcome := 'eliminated';
      v_reason := 'draw';
    elsif v_sel.team_id = v_fix.home_team_id and v_fix.home_score > v_fix.away_score then
      v_outcome := 'survived';
      v_reason := 'win';
    elsif v_sel.team_id = v_fix.away_team_id and v_fix.away_score > v_fix.home_score then
      v_outcome := 'survived';
      v_reason := 'win';
    else
      v_outcome := 'eliminated';
      v_reason := 'loss';
    end if;

    update selections
    set outcome = v_outcome,
        outcome_reason = v_reason,
        used_final = true,
        resolved_at = v_now,
        resolved_by_player_id = v_actor,
        locked_at = coalesce(locked_at, v_now),
        updated_at = v_now
    where id = v_sel.id;

    if v_outcome = 'survived' then
      v_survived := v_survived + 1;
    else
      v_eliminated := v_eliminated + 1;
      update game_entries
      set status = 'eliminated',
          eliminated_reason = v_reason,
          updated_at = now()
      where id = v_entry.id
        and status = 'active';
    end if;
  end loop;

  update selection_windows
  set status = 'resolved',
      resolved_at = v_now,
      resolved_by_player_id = v_actor,
      updated_at = v_now
  where id = p_window_id;

  return jsonb_build_object(
    'result', 'resolved',
    'window_id', p_window_id,
    'window_number', v_window.window_number,
    'survived', v_survived,
    'eliminated', v_eliminated,
    'no_pick', v_no_pick,
    'resolved_at', v_now
  );
end;
$$;

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

grant execute on function public.admin_apply_round_resolution(uuid) to authenticated;
grant execute on function public.admin_open_next_round(uuid, date, date, timestamptz) to authenticated;

commit;
