-- Game completion (winner paid / rollover) and start-next-game workflow.
-- Idempotent schema + admin RPCs. Does not complete Game 27 or create Game 28.

begin;

alter table games add column if not exists winner_display_name text;
alter table games add column if not exists completed_at timestamptz;
alter table games add column if not exists final_pot int;
alter table games add column if not exists prize_paid_amount int;
alter table games add column if not exists rollover_amount int not null default 0;
alter table games add column if not exists completion_notes text;
alter table games add column if not exists previous_game_id uuid references games(id) on delete set null;
alter table games add column if not exists rolled_from_game_id uuid references games(id) on delete set null;
alter table games add column if not exists rolled_from_game_number int;

alter table games drop constraint if exists games_final_pot_check;
alter table games add constraint games_final_pot_check check (final_pot is null or final_pot >= 0);
alter table games drop constraint if exists games_prize_paid_amount_check;
alter table games add constraint games_prize_paid_amount_check check (prize_paid_amount is null or prize_paid_amount >= 0);
alter table games drop constraint if exists games_rollover_amount_check;
alter table games add constraint games_rollover_amount_check check (rollover_amount >= 0);

create unique index if not exists games_one_live_game
  on games ((true))
  where status in ('open', 'in_progress');

create table if not exists historical_results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  game_id uuid references games(id) on delete set null,
  game_number int not null unique check (game_number >= 1),
  ended_at timestamptz,
  outcome text not null check (outcome in ('rolled_over','winner_declared','unknown','in_progress')),
  notes text
);

create table if not exists admin_actions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_player_id uuid not null references players(id) on delete restrict,
  action_type text not null,
  entity_table text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb
);

create or replace function public.assert_game_accepts_picks(p_game_id uuid)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  v_status game_status;
begin
  select status into v_status from games where id = p_game_id;
  if v_status is null then
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;
  if v_status not in ('open', 'in_progress') then
    perform public.pick_error('GAME_COMPLETE');
  end if;
end;
$$;

create or replace function public.submit_selection(p_window_id uuid, p_team_id text)
returns selections as $$
declare
  v_player_id uuid;
  v_entry game_entries%rowtype;
  v_window selection_windows%rowtype;
  v_fixture season_fixtures%rowtype;
  v_snapshot selection_window_eligible_fixtures%rowtype;
  v_selection selections%rowtype;
  v_now timestamptz := now();
begin
  select id into v_player_id from players where user_id = auth.uid();
  if v_player_id is null then
    perform public.pick_error('PLAYER_NOT_FOUND');
  end if;

  select * into v_entry
  from game_entries
  where player_id = v_player_id
    and game_id = (select game_id from selection_windows where id = p_window_id);

  if v_entry.id is null or not v_entry.paid or v_entry.status <> 'active' then
    perform public.pick_error('ENTRY_INACTIVE');
  end if;

  select * into v_window from selection_windows where id = p_window_id;
  if v_window.id is null then
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;

  perform public.assert_game_accepts_picks(v_window.game_id);

  if v_window.status <> 'open' then
    if v_window.status in ('locked', 'resolving', 'resolved') then
      perform public.pick_error('WINDOW_LOCKED');
    end if;
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;

  if v_window.window_number < 2 then
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;

  if v_now >= v_window.deadline_at then
    perform public.pick_error('DEADLINE_PASSED');
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

  if not exists (select 1 from selection_window_eligible_fixtures where window_id = p_window_id) then
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;

  if v_snapshot.kickoff_at <= v_now then
    perform public.pick_error('FIXTURE_STARTED');
  end if;

  if public.is_team_finally_used(v_window.game_id, v_player_id, p_team_id) then
    perform public.pick_error('TEAM_ALREADY_USED');
  end if;

  select * into v_fixture from season_fixtures where id = v_snapshot.season_fixture_id;

  insert into selections (
    game_id, window_id, player_id, team_id, season_fixture_id, locked_at,
    admin_corrected, corrected_by, correction_reason
  ) values (
    v_window.game_id, p_window_id, v_player_id, p_team_id, v_fixture.id, null,
    false, null, null
  )
  on conflict (window_id, player_id) do update set
    team_id = excluded.team_id,
    season_fixture_id = excluded.season_fixture_id,
    locked_at = null,
    updated_at = now()
  where selections.locked_at is null
  returning * into v_selection;

  if v_selection.id is null then
    perform public.pick_error('WINDOW_LOCKED');
  end if;

  return v_selection;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_submit_selection(
  p_player_id uuid,
  p_window_id uuid,
  p_team_id text
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
  v_game games%rowtype;
  v_fixture season_fixtures%rowtype;
  v_snapshot selection_window_eligible_fixtures%rowtype;
  v_selection selections%rowtype;
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

  select * into v_window from selection_windows where id = p_window_id;
  if v_window.id is null then
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;

  perform public.assert_game_accepts_picks(v_window.game_id);

  if v_window.window_number < 2 then
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;

  if v_window.status <> 'open' then
    if v_window.status in ('locked', 'resolving', 'resolved') then
      perform public.pick_error('WINDOW_LOCKED');
    end if;
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;

  if v_now >= v_window.deadline_at then
    perform public.pick_error('DEADLINE_PASSED');
  end if;

  select * into v_game from games where id = v_window.game_id;

  select * into v_entry
  from game_entries
  where player_id = p_player_id
    and game_id = v_window.game_id;

  if v_entry.id is null then
    insert into game_entries (
      game_id, player_id, entry_type, amount_due, entry_count, fee_set_by_admin,
      payment_claimed, paid, status
    )
    values (
      v_window.game_id, p_player_id, 'existing', coalesce(v_game.standard_entry_fee, 10), 1, false,
      false, false, 'active'
    )
    returning * into v_entry;
  elsif v_entry.status = 'pending_payment' then
    update game_entries
    set status = 'active'
    where id = v_entry.id
    returning * into v_entry;
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

  if v_snapshot.kickoff_at <= v_now then
    perform public.pick_error('FIXTURE_STARTED');
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
    true, v_actor, 'Entered by admin on behalf of player'
  )
  on conflict (window_id, player_id) do update set
    team_id = excluded.team_id,
    season_fixture_id = excluded.season_fixture_id,
    locked_at = null,
    admin_corrected = true,
    corrected_by = excluded.corrected_by,
    correction_reason = excluded.correction_reason,
    updated_at = now()
  where selections.locked_at is null
  returning * into v_selection;

  if v_selection.id is null then
    perform public.pick_error('WINDOW_LOCKED');
  end if;

  return v_selection;
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
  v_game games%rowtype;
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

  select * into v_game from games where id = v_current.game_id;
  if v_game.id is null then
    raise exception 'GAME_NOT_FOUND';
  end if;

  if v_game.status not in ('open', 'in_progress') then
    raise exception 'GAME_NOT_LIVE';
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

  if v_survivors = 1 then
    raise exception 'GAME_HAS_WINNER';
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

create or replace function public.admin_complete_game(
  p_game_id uuid,
  p_completion_type text,
  p_winner_player_id uuid default null,
  p_final_pot int default null,
  p_prize_paid_amount int default null,
  p_rollover_amount int default null,
  p_notes text default null,
  p_non_survivor_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_game games%rowtype;
  v_winner players%rowtype;
  v_final_pot int;
  v_prize int;
  v_rollover int;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_reason text := nullif(btrim(coalesce(p_non_survivor_reason, '')), '');
  v_is_survivor boolean := false;
  v_now timestamptz := now();
  v_status game_status;
  v_result_type text;
  v_history_outcome text;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select id into v_actor from players where user_id = auth.uid();
  if v_actor is null then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  select * into v_game from games where id = p_game_id for update;
  if v_game.id is null then
    raise exception 'GAME_NOT_FOUND';
  end if;

  if v_game.status in ('complete', 'rolled_over') then
    if v_game.result_type = p_completion_type
       and (
         (p_completion_type = 'winner_paid' and v_game.winner_player_id is not distinct from p_winner_player_id)
         or p_completion_type = 'rollover'
       )
    then
      return jsonb_build_object(
        'result', 'already_complete',
        'game', to_jsonb(v_game)
      );
    end if;
    raise exception 'GAME_ALREADY_COMPLETE';
  end if;

  if p_completion_type not in ('winner_paid', 'rollover') then
    raise exception 'INVALID_COMPLETION_TYPE';
  end if;

  v_final_pot := coalesce(p_final_pot, v_game.current_pot);
  if v_final_pot < 0 then
    raise exception 'INVALID_POT';
  end if;

  if p_completion_type = 'winner_paid' then
    if p_winner_player_id is null then
      raise exception 'WINNER_REQUIRED';
    end if;

    select * into v_winner from players where id = p_winner_player_id;
    if v_winner.id is null then
      raise exception 'WINNER_NOT_FOUND';
    end if;

    if coalesce(p_rollover_amount, 0) > 0 then
      raise exception 'WINNER_PAID_CANNOT_HAVE_ROLLOVER';
    end if;

    select exists (
      select 1
      from game_entries
      where game_id = v_game.id
        and player_id = p_winner_player_id
        and paid
        and status in ('active', 'winner')
    ) into v_is_survivor;

    if not v_is_survivor and v_reason is null then
      raise exception 'WINNER_NOT_SURVIVOR';
    end if;

    v_prize := coalesce(p_prize_paid_amount, v_final_pot);
    if v_prize < 0 then
      raise exception 'INVALID_POT';
    end if;
    v_rollover := 0;
    v_status := 'complete';
    v_result_type := 'winner_paid';
    v_history_outcome := 'winner_declared';

    update game_entries
    set status = 'winner',
        updated_at = v_now
    where game_id = v_game.id
      and player_id = p_winner_player_id
      and status in ('active', 'pending_payment');
  else
    if p_winner_player_id is not null then
      raise exception 'ROLLOVER_CANNOT_HAVE_WINNER';
    end if;
    if v_notes is null then
      raise exception 'NOTES_REQUIRED';
    end if;
    v_prize := 0;
    v_rollover := coalesce(p_rollover_amount, v_game.current_pot);
    if v_rollover < 0 then
      raise exception 'INVALID_POT';
    end if;
    v_status := 'rolled_over';
    v_result_type := 'rollover';
    v_history_outcome := 'rolled_over';
  end if;

  update games
  set status = v_status,
      result_type = v_result_type,
      winner_player_id = case when p_completion_type = 'winner_paid' then p_winner_player_id else null end,
      winner_display_name = case when p_completion_type = 'winner_paid' then v_winner.display_name else null end,
      final_pot = v_final_pot,
      prize_paid_amount = v_prize,
      rollover_amount = v_rollover,
      completion_notes = case
        when p_completion_type = 'winner_paid' and v_reason is not null
          then concat_ws(' | ', v_notes, concat('Non-survivor winner reason: ', v_reason))
        else v_notes
      end,
      completed_at = v_now,
      closed_at = v_now,
      current_pot = v_final_pot
  where id = v_game.id
  returning * into v_game;

  insert into historical_results (game_id, game_number, ended_at, outcome, notes)
  values (v_game.id, v_game.game_number, v_now, v_history_outcome, v_game.completion_notes)
  on conflict (game_number) do update set
    game_id = excluded.game_id,
    ended_at = excluded.ended_at,
    outcome = excluded.outcome,
    notes = excluded.notes;

  insert into admin_actions (actor_player_id, action_type, entity_table, entity_id, payload)
  values (
    v_actor,
    'update_game',
    'games',
    v_game.id::text,
    jsonb_build_object(
      'action', 'complete_game',
      'completion_type', p_completion_type,
      'winner_player_id', p_winner_player_id,
      'final_pot', v_final_pot,
      'prize_paid_amount', v_prize,
      'rollover_amount', v_rollover
    )
  );

  return jsonb_build_object(
    'result', 'completed',
    'game', to_jsonb(v_game)
  );
end;
$$;

create or replace function public.admin_start_new_game(
  p_previous_game_id uuid default null,
  p_game_number int default null,
  p_season text default null,
  p_opening_pot int default null,
  p_carry_forward_players boolean default true,
  p_allow_standalone boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_previous games%rowtype;
  v_existing games%rowtype;
  v_new games%rowtype;
  v_number int;
  v_opening int;
  v_live_count int;
  v_entry_count int := 0;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select id into v_actor from players where user_id = auth.uid();
  if v_actor is null then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  if p_previous_game_id is not null then
    select * into v_previous from games where id = p_previous_game_id;
  else
    select * into v_previous from games order by game_number desc limit 1;
  end if;

  if v_previous.id is null then
    raise exception 'GAME_NOT_FOUND';
  end if;

  if v_previous.status not in ('complete', 'rolled_over') and not coalesce(p_allow_standalone, false) then
    raise exception 'PREVIOUS_GAME_NOT_COMPLETE';
  end if;

  v_number := coalesce(p_game_number, v_previous.game_number + 1);
  if v_number < 1 then
    raise exception 'INVALID_GAME_NUMBER';
  end if;

  select * into v_existing from games where game_number = v_number;
  if v_existing.id is not null then
    return jsonb_build_object(
      'result', 'already_exists',
      'game', to_jsonb(v_existing)
    );
  end if;

  select count(*) into v_live_count
  from games
  where status in ('open', 'in_progress');

  if v_live_count > 0 then
    raise exception 'DUPLICATE_OPEN_GAME';
  end if;

  if p_opening_pot is not null then
    v_opening := p_opening_pot;
  elsif v_previous.result_type = 'rollover' or v_previous.status = 'rolled_over' then
    v_opening := coalesce(v_previous.rollover_amount, v_previous.current_pot, 0);
  else
    v_opening := 0;
  end if;

  if v_opening < 0 then
    raise exception 'INVALID_POT';
  end if;

  insert into games (
    game_number,
    season,
    status,
    standard_entry_fee,
    newbie_entry_fee,
    rollover_contribution,
    opening_pot,
    current_pot,
    result_type,
    opened_at,
    previous_game_id,
    rolled_from_game_id,
    rolled_from_game_number
  )
  values (
    v_number,
    coalesce(nullif(btrim(coalesce(p_season, '')), ''), v_previous.season),
    'open',
    v_previous.standard_entry_fee,
    v_previous.newbie_entry_fee,
    v_previous.rollover_contribution,
    v_opening,
    v_opening,
    'none',
    now(),
    v_previous.id,
    case
      when v_previous.result_type = 'rollover' or v_previous.status = 'rolled_over' then v_previous.id
      else null
    end,
    case
      when v_previous.result_type = 'rollover' or v_previous.status = 'rolled_over' then v_previous.game_number
      else null
    end
  )
  returning * into v_new;

  if coalesce(p_carry_forward_players, true) then
    insert into game_entries (
      game_id, player_id, entry_type, amount_due, entry_count, fee_set_by_admin,
      payment_claimed, paid, paid_at, status, eliminated_reason
    )
    select
      v_new.id,
      ge.player_id,
      'existing',
      v_new.standard_entry_fee,
      1,
      false,
      false,
      false,
      null,
      'pending_payment',
      null
    from game_entries ge
    where ge.game_id = v_previous.id
    on conflict (game_id, player_id) do nothing;

    get diagnostics v_entry_count = row_count;
  end if;

  insert into admin_actions (actor_player_id, action_type, entity_table, entity_id, payload)
  values (
    v_actor,
    'create_game',
    'games',
    v_new.id::text,
    jsonb_build_object(
      'action', 'start_new_game',
      'previous_game_id', v_previous.id,
      'game_number', v_new.game_number,
      'opening_pot', v_opening,
      'carry_forward_players', coalesce(p_carry_forward_players, true),
      'entry_count', v_entry_count,
      'opening_pot_overridden', p_opening_pot is not null
    )
  );

  return jsonb_build_object(
    'result', 'created',
    'game', to_jsonb(v_new),
    'entry_count', v_entry_count
  );
exception
  when unique_violation then
    select * into v_existing
    from games
    where game_number = coalesce(p_game_number, v_previous.game_number + 1)
    order by game_number desc
    limit 1;
    if v_existing.id is null then
      raise;
    end if;
    return jsonb_build_object(
      'result', 'already_exists',
      'game', to_jsonb(v_existing)
    );
end;
$$;

create or replace function public.admin_open_first_round(
  p_game_id uuid,
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
  v_game games%rowtype;
  v_existing selection_windows%rowtype;
  v_new selection_windows%rowtype;
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

  select * into v_game from games where id = p_game_id;
  if v_game.id is null then
    raise exception 'GAME_NOT_FOUND';
  end if;

  if v_game.status not in ('open', 'in_progress') then
    raise exception 'GAME_NOT_LIVE';
  end if;

  select * into v_existing
  from selection_windows
  where game_id = v_game.id
    and window_number >= 2
    and status in ('pending', 'open', 'locked', 'resolving')
  order by window_number asc
  limit 1;

  if found then
    return jsonb_build_object(
      'result', 'already_open',
      'window_id', v_existing.id,
      'window_number', v_existing.window_number,
      'deadline_at', v_existing.deadline_at
    );
  end if;

  insert into selection_windows (
    game_id, window_number, status,
    eligible_sat_date, eligible_sun_date,
    deadline_at, start_at, end_at
  )
  values (
    v_game.id,
    2,
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

  insert into admin_actions (actor_player_id, action_type, entity_table, entity_id, payload)
  values (
    v_actor,
    'set_selection_window',
    'selection_windows',
    v_new.id::text,
    jsonb_build_object(
      'action', 'open_first_round',
      'game_id', v_game.id,
      'game_number', v_game.game_number,
      'window_number', v_new.window_number,
      'sat', p_sat,
      'sun', p_sun
    )
  );

  return jsonb_build_object(
    'result', 'opened',
    'window_id', v_new.id,
    'window_number', v_new.window_number,
    'fixture_count', v_fixture_count,
    'deadline_at', v_new.deadline_at,
    'sat', p_sat,
    'sun', p_sun
  );
end;
$$;

grant execute on function public.assert_game_accepts_picks(uuid) to authenticated;
grant execute on function public.admin_complete_game(uuid, text, uuid, int, int, int, text, text) to authenticated;
grant execute on function public.admin_start_new_game(uuid, int, text, int, boolean, boolean) to authenticated;
grant execute on function public.admin_open_first_round(uuid, date, date, timestamptz) to authenticated;
grant execute on function public.admin_open_next_round(uuid, date, date, timestamptz) to authenticated;
grant execute on function public.submit_selection(uuid, text) to authenticated;
grant execute on function public.admin_submit_selection(uuid, uuid, text) to authenticated;

commit;
