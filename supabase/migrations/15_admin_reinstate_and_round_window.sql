-- Audited admin player reinstatement and open-round deadline edits.
-- Does not change production picks, entries, or windows by itself.

begin;

create table if not exists admin_actions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_player_id uuid not null references players(id),
  action_type text not null,
  entity_table text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb
);

alter table admin_actions enable row level security;

create or replace function public.admin_reinstate_player(
  p_player_id uuid,
  p_game_id uuid,
  p_window_id uuid,
  p_reason text,
  p_confirm boolean,
  p_team_id text default null,
  p_confirm_without_winning_pick boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_game games%rowtype;
  v_window selection_windows%rowtype;
  v_entry game_entries%rowtype;
  v_selection selections%rowtype;
  v_snapshot selection_window_eligible_fixtures%rowtype;
  v_fixture season_fixtures%rowtype;
  v_reason text;
  v_team text;
  v_now timestamptz := now();
  v_fixture_final boolean := false;
  v_team_won boolean := false;
  v_already boolean := false;
  v_created_at timestamptz;
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

  select * into v_game from games where id = p_game_id;
  if v_game.id is null then
    raise exception 'GAME_NOT_FOUND';
  end if;

  if v_game.status not in ('open', 'in_progress') then
    perform public.pick_error('GAME_COMPLETE');
  end if;

  select * into v_window from selection_windows where id = p_window_id;
  if v_window.id is null or v_window.game_id <> p_game_id or v_window.window_number < 2 then
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;

  select * into v_entry
  from game_entries
  where player_id = p_player_id
    and game_id = p_game_id;

  if v_entry.id is null then
    perform public.pick_error('PLAYER_NOT_FOUND');
  end if;

  if not v_entry.paid or v_entry.status in ('withdrawn', 'winner', 'pending_payment') then
    perform public.pick_error('ENTRY_INACTIVE');
  end if;

  select * into v_selection
  from selections
  where window_id = p_window_id
    and player_id = p_player_id;

  v_team := nullif(trim(coalesce(p_team_id, '')), '');
  if v_team is null then
    v_team := v_selection.team_id;
  end if;

  v_reason := trim(coalesce(p_reason, ''));

  if v_team is not null then
    select * into v_snapshot
    from selection_window_eligible_fixtures
    where window_id = p_window_id
      and (home_team_id = v_team or away_team_id = v_team)
    order by kickoff_at asc
    limit 1;

    if v_snapshot.id is null then
      perform public.pick_error('TEAM_NOT_ELIGIBLE');
    end if;

    select * into v_fixture from season_fixtures where id = v_snapshot.season_fixture_id;

    v_fixture_final :=
      v_fixture.status = 'finished'
      and v_fixture.result_status = 'final'
      and v_fixture.home_score is not null
      and v_fixture.away_score is not null;

    if not v_fixture_final then
      perform public.pick_error('RESULT_NOT_FINAL');
    end if;

    if v_team = v_snapshot.home_team_id and v_fixture.home_score > v_fixture.away_score then
      v_team_won := true;
    elsif v_team = v_snapshot.away_team_id and v_fixture.away_score > v_fixture.home_score then
      v_team_won := true;
    else
      v_team_won := false;
    end if;
  end if;

  if v_team_won then
    if char_length(v_reason) < 8 then
      perform public.pick_error('LATE_REASON_REQUIRED');
    end if;
  else
    if p_confirm_without_winning_pick is not true or char_length(v_reason) < 24 then
      perform public.pick_error('WINNING_PICK_REQUIRED');
    end if;
  end if;

  if v_team is not null
     and public.is_team_finally_used(p_game_id, p_player_id, v_team)
     and coalesce(v_selection.team_id, '') is distinct from v_team then
    perform public.pick_error('TEAM_ALREADY_USED');
  end if;

  v_already :=
    v_entry.status = 'active'
    and v_selection.id is not null
    and v_selection.outcome = 'survived'
    and coalesce(v_selection.used_final, false) = true
    and (v_team is null or v_selection.team_id = v_team);

  if v_already then
    return jsonb_build_object(
      'result', 'already_reinstated',
      'entry_id', v_entry.id,
      'selection_id', v_selection.id,
      'player_id', p_player_id,
      'game_id', p_game_id,
      'window_id', p_window_id,
      'team_id', v_selection.team_id,
      'entry_status', v_entry.status,
      'outcome', v_selection.outcome,
      'used_final', v_selection.used_final,
      'admin_corrected', v_selection.admin_corrected,
      'duplicated_entry', false,
      'duplicated_selection', false
    );
  end if;

  if v_team_won then
    v_created_at := v_selection.created_at;

    insert into selections (
      game_id, window_id, player_id, team_id, season_fixture_id,
      status, locked_at, admin_corrected, corrected_by, correction_reason,
      outcome, outcome_reason, used_final, resolved_at, resolved_by_player_id,
      created_at
    ) values (
      p_game_id, p_window_id, p_player_id, v_team, v_fixture.id,
      coalesce(v_selection.status, 'submitted'), coalesce(v_selection.locked_at, v_now),
      true, v_actor, v_reason,
      'survived', 'win', true, coalesce(v_selection.resolved_at, v_now), v_actor,
      coalesce(v_created_at, v_now)
    )
    on conflict (window_id, player_id) do update set
      team_id = excluded.team_id,
      season_fixture_id = excluded.season_fixture_id,
      status = 'submitted',
      admin_corrected = true,
      corrected_by = excluded.corrected_by,
      correction_reason = excluded.correction_reason,
      outcome = 'survived',
      outcome_reason = 'win',
      used_final = true,
      resolved_at = coalesce(selections.resolved_at, excluded.resolved_at),
      resolved_by_player_id = excluded.resolved_by_player_id,
      locked_at = coalesce(selections.locked_at, excluded.locked_at),
      updated_at = now()
    returning * into v_selection;
  elsif v_selection.id is not null then
    update selections
    set admin_corrected = true,
        corrected_by = v_actor,
        correction_reason = v_reason,
        updated_at = now()
    where id = v_selection.id
    returning * into v_selection;
  end if;

  update game_entries
  set status = 'active',
      eliminated_reason = null,
      updated_at = now()
  where id = v_entry.id
    and status <> 'withdrawn'
  returning * into v_entry;

  insert into admin_actions (actor_player_id, action_type, entity_table, entity_id, payload)
  values (
    v_actor,
    'reinstate_player',
    'game_entries',
    v_entry.id::text,
    jsonb_build_object(
      'player_id', p_player_id,
      'game_id', p_game_id,
      'window_id', p_window_id,
      'selection_id', v_selection.id,
      'team_id', v_selection.team_id,
      'reason', v_reason,
      'winning_pick', v_team_won,
      'confirm_without_winning_pick', coalesce(p_confirm_without_winning_pick, false)
    )
  );

  return jsonb_build_object(
    'result', 'reinstated',
    'entry_id', v_entry.id,
    'selection_id', v_selection.id,
    'player_id', p_player_id,
    'game_id', p_game_id,
    'window_id', p_window_id,
    'team_id', v_selection.team_id,
    'entry_status', v_entry.status,
    'outcome', v_selection.outcome,
    'used_final', v_selection.used_final,
    'admin_corrected', true,
    'correction_reason', v_reason,
    'duplicated_entry', false,
    'duplicated_selection', false
  );
end;
$$;

create or replace function public.admin_update_round_window(
  p_window_id uuid,
  p_deadline timestamptz,
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
  v_window selection_windows%rowtype;
  v_game games%rowtype;
  v_reason text;
  v_pick_count int;
  v_old_deadline timestamptz;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_confirm is not true then
    perform public.pick_error('CORRECTION_NOT_CONFIRMED');
  end if;

  if p_deadline is null then
    perform public.pick_error('INVALID_DEADLINE');
  end if;

  select id into v_actor from players where user_id = auth.uid();
  if v_actor is null then
    perform public.pick_error('PLAYER_NOT_FOUND');
  end if;

  select * into v_window from selection_windows where id = p_window_id;
  if v_window.id is null or v_window.window_number < 2 then
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;

  select * into v_game from games where id = v_window.game_id;
  if v_game.id is null then
    raise exception 'GAME_NOT_FOUND';
  end if;

  if v_game.status not in ('open', 'in_progress') then
    perform public.pick_error('GAME_COMPLETE');
  end if;

  if v_window.status in ('resolved', 'resolving', 'complete', 'cancelled') then
    perform public.pick_error('ROUND_ALREADY_RESOLVED');
  end if;

  if v_window.status not in ('open', 'locked') then
    perform public.pick_error('ROUND_NOT_EDITABLE');
  end if;

  if v_window.earliest_kickoff_at is not null and p_deadline >= v_window.earliest_kickoff_at then
    perform public.pick_error('DEADLINE_AFTER_KICKOFF');
  end if;

  select count(*) into v_pick_count
  from selections
  where window_id = p_window_id
    and team_id is not null;

  v_reason := trim(coalesce(p_reason, ''));
  if v_pick_count > 0 or now() >= v_window.deadline_at or char_length(v_reason) < 8 then
    if char_length(v_reason) < 8 then
      perform public.pick_error('LATE_REASON_REQUIRED');
    end if;
  end if;

  if v_window.deadline_at is not distinct from p_deadline then
    return jsonb_build_object(
      'result', 'unchanged',
      'window_id', v_window.id,
      'old_deadline_at', v_window.deadline_at,
      'new_deadline_at', v_window.deadline_at,
      'pick_count', v_pick_count,
      'snapshot_changed', false
    );
  end if;

  v_old_deadline := v_window.deadline_at;

  update selection_windows
  set deadline_at = p_deadline,
      status = case
        when status = 'locked' and p_deadline > now() then 'open'
        else status
      end,
      updated_at = now()
  where id = p_window_id
  returning * into v_window;

  insert into admin_actions (actor_player_id, action_type, entity_table, entity_id, payload)
  values (
    v_actor,
    'update_round_window',
    'selection_windows',
    v_window.id::text,
    jsonb_build_object(
      'game_id', v_window.game_id,
      'window_number', v_window.window_number,
      'old_deadline_at', v_old_deadline,
      'new_deadline_at', v_window.deadline_at,
      'reason', v_reason,
      'pick_count', v_pick_count
    )
  );

  return jsonb_build_object(
    'result', 'updated',
    'window_id', v_window.id,
    'window_number', v_window.window_number,
    'old_deadline_at', v_old_deadline,
    'new_deadline_at', v_window.deadline_at,
    'status', v_window.status,
    'pick_count', v_pick_count,
    'snapshot_changed', false
  );
end;
$$;

revoke all on function public.admin_reinstate_player(uuid, uuid, uuid, text, boolean, text, boolean) from public;
grant execute on function public.admin_reinstate_player(uuid, uuid, uuid, text, boolean, text, boolean) to authenticated;

revoke all on function public.admin_update_round_window(uuid, timestamptz, text, boolean) from public;
grant execute on function public.admin_update_round_window(uuid, timestamptz, text, boolean) to authenticated;

commit;
