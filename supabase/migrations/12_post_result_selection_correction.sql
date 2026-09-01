-- Post-result late correction plus the late-pick RPC if migration 11 was never applied.
-- Does not change Round 1, payments, pot, Window 1, or fixture snapshots.

create or replace function public.admin_submit_late_selection(
  p_player_id uuid,
  p_window_id uuid,
  p_team_id text,
  p_reason text
)
returns selections
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_entry game_entries%rowtype;
  v_window selection_windows%rowtype;
  v_fixture season_fixtures%rowtype;
  v_snapshot selection_window_eligible_fixtures%rowtype;
  v_selection selections%rowtype;
  v_reason text;
  v_now timestamptz := now();
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select id into v_actor from players where user_id = auth.uid();
  if v_actor is null then
    perform public.pick_error('PLAYER_NOT_FOUND');
  end if;

  if not exists (select 1 from players where id = p_player_id) then
    perform public.pick_error('PLAYER_NOT_FOUND');
  end if;

  v_reason := trim(coalesce(p_reason, ''));
  if char_length(v_reason) < 8 then
    perform public.pick_error('LATE_REASON_REQUIRED');
  end if;

  select * into v_window from selection_windows where id = p_window_id;
  if v_window.id is null then
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;

  if v_window.window_number < 2 then
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;

  if v_window.status in ('resolved', 'resolving') then
    perform public.pick_error('ROUND_ALREADY_RESOLVED');
  end if;

  if v_window.status not in ('open', 'locked') then
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;

  select * into v_entry
  from game_entries
  where player_id = p_player_id
    and game_id = v_window.game_id;

  if v_entry.id is null or not v_entry.paid or v_entry.status <> 'active' then
    perform public.pick_error('ENTRY_INACTIVE');
  end if;

  select * into v_snapshot
  from selection_window_eligible_fixtures
  where window_id = p_window_id
    and (home_team_id = p_team_id or away_team_id = p_team_id)
  order by kickoff_at asc
  limit 1;

  if v_snapshot.id is null then
    perform public.pick_error('TEAM_NOT_ELIGIBLE');
  end if;

  if public.is_team_finally_used(v_window.game_id, p_player_id, p_team_id) then
    perform public.pick_error('TEAM_ALREADY_USED');
  end if;

  select * into v_fixture from season_fixtures where id = v_snapshot.season_fixture_id;

  insert into selections (
    game_id, window_id, player_id, team_id, season_fixture_id, locked_at,
    admin_corrected, corrected_by, correction_reason
  ) values (
    v_window.game_id, p_window_id, p_player_id, p_team_id, v_fixture.id, null,
    true, v_actor, v_reason
  )
  on conflict (window_id, player_id) do update set
    team_id = excluded.team_id,
    season_fixture_id = excluded.season_fixture_id,
    admin_corrected = true,
    corrected_by = excluded.corrected_by,
    correction_reason = excluded.correction_reason,
    updated_at = now()
  returning * into v_selection;

  if v_selection.id is null then
    perform public.pick_error('WINDOW_LOCKED');
  end if;

  return v_selection;
end;
$$;

create or replace function public.admin_apply_post_result_selection_correction(
  p_player_id uuid,
  p_window_id uuid,
  p_team_id text,
  p_reason text,
  p_confirm boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_entry game_entries%rowtype;
  v_window selection_windows%rowtype;
  v_fixture season_fixtures%rowtype;
  v_snapshot selection_window_eligible_fixtures%rowtype;
  v_selection selections%rowtype;
  v_reason text;
  v_now timestamptz := now();
  v_outcome text;
  v_outcome_reason text;
  v_fixture_final boolean := false;
  v_apply_outcome boolean := false;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_confirm is not true then
    perform public.pick_error('CORRECTION_NOT_CONFIRMED');
  end if;

  select id into v_actor from players where user_id = auth.uid();
  if v_actor is null then
    perform public.pick_error('PLAYER_NOT_FOUND');
  end if;

  if not exists (select 1 from players where id = p_player_id) then
    perform public.pick_error('PLAYER_NOT_FOUND');
  end if;

  v_reason := trim(coalesce(p_reason, ''));
  if char_length(v_reason) < 8 then
    perform public.pick_error('LATE_REASON_REQUIRED');
  end if;

  select * into v_window from selection_windows where id = p_window_id;
  if v_window.id is null then
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;

  if v_window.window_number < 2 then
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;

  if v_window.status not in ('open', 'locked', 'resolved') then
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;

  select * into v_entry
  from game_entries
  where player_id = p_player_id
    and game_id = v_window.game_id;

  if v_entry.id is null or not v_entry.paid then
    perform public.pick_error('ENTRY_INACTIVE');
  end if;

  if v_entry.status = 'withdrawn' then
    perform public.pick_error('ENTRY_INACTIVE');
  end if;

  if v_window.status in ('open', 'locked') and v_entry.status <> 'active' then
    perform public.pick_error('ENTRY_INACTIVE');
  end if;

  select * into v_snapshot
  from selection_window_eligible_fixtures
  where window_id = p_window_id
    and (home_team_id = p_team_id or away_team_id = p_team_id)
  order by kickoff_at asc
  limit 1;

  if v_snapshot.id is null then
    perform public.pick_error('TEAM_NOT_ELIGIBLE');
  end if;

  if public.is_team_finally_used(v_window.game_id, p_player_id, p_team_id) then
    if not exists (
      select 1
      from selections
      where window_id = p_window_id
        and player_id = p_player_id
        and team_id = p_team_id
    ) then
      perform public.pick_error('TEAM_ALREADY_USED');
    end if;
  end if;

  select * into v_fixture from season_fixtures where id = v_snapshot.season_fixture_id;

  v_fixture_final :=
    v_fixture.status = 'finished'
    and v_fixture.result_status = 'final'
    and v_fixture.home_score is not null
    and v_fixture.away_score is not null;

  if v_window.status = 'resolved' and not v_fixture_final then
    perform public.pick_error('RESULT_NOT_FINAL');
  end if;

  -- Apply the stored final score even if the round is still open, so an accepted
  -- late pick can be survived/eliminated without resolving the whole round.
  v_apply_outcome := v_fixture_final;
  v_outcome := null;
  v_outcome_reason := null;

  if v_apply_outcome then
    if v_fixture.home_score = v_fixture.away_score then
      v_outcome := 'eliminated';
      v_outcome_reason := 'draw';
    elsif p_team_id = v_snapshot.home_team_id and v_fixture.home_score > v_fixture.away_score then
      v_outcome := 'survived';
      v_outcome_reason := 'win';
    elsif p_team_id = v_snapshot.away_team_id and v_fixture.away_score > v_fixture.home_score then
      v_outcome := 'survived';
      v_outcome_reason := 'win';
    else
      v_outcome := 'eliminated';
      v_outcome_reason := 'loss';
    end if;
  end if;

  insert into selections (
    game_id, window_id, player_id, team_id, season_fixture_id, locked_at,
    admin_corrected, corrected_by, correction_reason,
    outcome, outcome_reason, used_final, resolved_at, resolved_by_player_id
  ) values (
    v_window.game_id, p_window_id, p_player_id, p_team_id, v_fixture.id, v_now,
    true, v_actor, v_reason,
    v_outcome, v_outcome_reason, v_apply_outcome, case when v_apply_outcome then v_now else null end, case when v_apply_outcome then v_actor else null end
  )
  on conflict (window_id, player_id) do update set
    team_id = excluded.team_id,
    season_fixture_id = excluded.season_fixture_id,
    admin_corrected = true,
    corrected_by = excluded.corrected_by,
    correction_reason = excluded.correction_reason,
    outcome = excluded.outcome,
    outcome_reason = excluded.outcome_reason,
    used_final = excluded.used_final,
    resolved_at = excluded.resolved_at,
    resolved_by_player_id = excluded.resolved_by_player_id,
    locked_at = coalesce(selections.locked_at, excluded.locked_at),
    updated_at = now()
  returning * into v_selection;

  if v_apply_outcome and v_outcome = 'survived' then
    update game_entries
    set status = 'active',
        eliminated_reason = null,
        updated_at = now()
    where id = v_entry.id
      and status <> 'withdrawn';
  elsif v_apply_outcome then
    update game_entries
    set status = 'eliminated',
        eliminated_reason = v_outcome_reason,
        updated_at = now()
    where id = v_entry.id
      and status <> 'withdrawn';
  end if;

  return jsonb_build_object(
    'result', 'corrected',
    'selection_id', v_selection.id,
    'player_id', p_player_id,
    'window_id', p_window_id,
    'team_id', p_team_id,
    'outcome', v_outcome,
    'outcome_reason', v_outcome_reason,
    'used_final', v_apply_outcome,
    'admin_corrected', true,
    'correction_reason', v_reason,
    'window_status', v_window.status,
    'fixture_final', v_fixture_final
  );
end;
$$;

revoke all on function public.admin_submit_late_selection(uuid, uuid, text, text) from public;
grant execute on function public.admin_submit_late_selection(uuid, uuid, text, text) to authenticated;

revoke all on function public.admin_apply_post_result_selection_correction(uuid, uuid, text, text, boolean) from public;
grant execute on function public.admin_apply_post_result_selection_correction(uuid, uuid, text, text, boolean) to authenticated;

-- Repair stale canonical_key dates so result mapping can match Sunday/Monday kickoffs.
-- Does not change selection_window_eligible_fixtures snapshots.
update public.season_fixtures
set canonical_key = concat_ws(
  '|',
  split_part(canonical_key, '|', 1),
  home_team_id,
  away_team_id,
  to_char((kickoff_at at time zone 'Europe/London'), 'YYYY-MM-DD')
)
where season = '2026/27'
  and canonical_key is not null
  and split_part(canonical_key, '|', 4)
    is distinct from to_char((kickoff_at at time zone 'Europe/London'), 'YYYY-MM-DD');

