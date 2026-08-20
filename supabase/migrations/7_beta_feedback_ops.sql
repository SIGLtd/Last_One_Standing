-- Game 27 live ops: manual players, admin proxy picks, pot override, Round 1 deadline, indexes.
-- Idempotent. Does not change Round 1 fixtures, Window 1, picks, or payment paid/claimed flags.

begin;

-- ---------------------------------------------------------------------------
-- Manual / offline players
-- ---------------------------------------------------------------------------
alter table players alter column user_id drop not null;
alter table players alter column email drop not null;
alter table players add column if not exists is_manual boolean not null default false;

alter table game_entries add column if not exists entry_count int not null default 1;
alter table game_entries add column if not exists fee_set_by_admin boolean not null default false;

alter table game_entries drop constraint if exists game_entries_entry_count_check;
alter table game_entries add constraint game_entries_entry_count_check check (entry_count >= 1);

-- ---------------------------------------------------------------------------
-- Indexes for common login / pick / admin paths
-- ---------------------------------------------------------------------------
create index if not exists idx_players_user_id on players(user_id);
create index if not exists idx_players_is_manual on players(is_manual) where is_manual = true;
create index if not exists idx_game_entries_game_status on game_entries(game_id, status);
create index if not exists idx_selections_game_player on selections(game_id, player_id);
create index if not exists idx_selections_window_id on selections(window_id);
create index if not exists idx_selection_windows_game_status_number
  on selection_windows(game_id, status, window_number);

-- ---------------------------------------------------------------------------
-- Live Round 1 deadline: Friday 21 August 2026, 16:00 BST = 15:00 UTC
-- Window number 2 is the live operational round. Window 1 is not touched.
-- ---------------------------------------------------------------------------
update selection_windows sw
set deadline_at = timestamptz '2026-08-21 15:00:00+00'
from games g
where sw.game_id = g.id
  and g.game_number = 27
  and sw.window_number = 2
  and sw.deadline_at is distinct from timestamptz '2026-08-21 15:00:00+00';

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_game_pot(p_game_id uuid, p_current_pot int)
returns games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game games%rowtype;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_current_pot < 0 then
    raise exception 'INVALID_POT';
  end if;

  update games
  set current_pot = p_current_pot
  where id = p_game_id
  returning * into v_game;

  if v_game.id is null then
    raise exception 'GAME_NOT_FOUND';
  end if;

  return v_game;
end;
$$;

create or replace function public.admin_create_manual_player(
  p_display_name text,
  p_phone text default null
)
returns players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player players%rowtype;
  v_game games%rowtype;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if char_length(trim(p_display_name)) < 2 then
    raise exception 'INVALID_NAME';
  end if;

  insert into players (user_id, display_name, phone, email, is_admin, is_manual)
  values (null, trim(p_display_name), nullif(trim(coalesce(p_phone, '')), ''), null, false, true)
  returning * into v_player;

  select * into v_game from games where game_number = 27;

  if v_game.id is not null then
    insert into game_entries (
      game_id, player_id, entry_type, amount_due, entry_count, fee_set_by_admin,
      payment_claimed, paid, status
    )
    values (
      v_game.id, v_player.id, 'existing', v_game.standard_entry_fee, 1, false,
      false, false, 'pending_payment'
    )
    on conflict (game_id, player_id) do nothing;
  end if;

  return v_player;
end;
$$;

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

grant execute on function public.admin_update_game_pot(uuid, int) to authenticated;
grant execute on function public.admin_create_manual_player(text, text) to authenticated;
grant execute on function public.admin_submit_selection(uuid, uuid, text) to authenticated;

commit;
