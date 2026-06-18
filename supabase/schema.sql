-- Last One Standing (Premier League survival pool) - Milestone 2B schema
-- Notes:
-- - Keep policies simple for now; tighten later.
-- - No external football APIs yet; fixtures/results can be entered manually.
-- - When fixtures are synced, include Saturday and Sunday Premier League games only (exclude Friday/Monday).
--
-- Milestone 2A migration (if players table exists from Milestone 1):
--   alter table players rename column auth_user_id to user_id;
--   alter table players rename column phone_number to phone;
--   alter table players alter column phone drop not null;
--   alter table players drop column if exists status;
--   drop policy if exists "players_read_all" on players;
--
-- Milestone 2B migration (if games/game_entries exist from earlier milestones):
--   See supabase/migrations/2b_games_and_entries.sql or run the replacement DDL below on a fresh DB.

begin;

-- Extensions
create extension if not exists pgcrypto;

-- Enums
do $$ begin
  create type payment_status as enum ('unpaid','partial','paid','waived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type game_status as enum ('off_season','open','in_progress','complete','rolled_over');
exception when duplicate_object then null; end $$;

do $$ begin
  create type selection_window_status as enum ('pending','open','locked','resolving','resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fixture_status as enum ('scheduled','in_play','finished','postponed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type entry_type as enum ('existing','newbie','admin_comp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type entry_status as enum ('pending_payment','active','eliminated','winner','withdrawn');
exception when duplicate_object then null; end $$;

-- Core tables
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) >= 2),
  phone text,
  email text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  game_number int not null unique check (game_number >= 1),
  season text not null,
  status game_status not null default 'off_season',
  standard_entry_fee int not null default 10 check (standard_entry_fee >= 0),
  newbie_entry_fee int not null default 30 check (newbie_entry_fee >= 0),
  rollover_contribution int not null default 20 check (rollover_contribution >= 0),
  opening_pot int not null default 0 check (opening_pot >= 0),
  current_pot int not null default 0 check (current_pot >= 0),
  winner_player_id uuid references players(id) on delete set null,
  result_type text not null default 'none',
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  closed_at timestamptz
);

create table if not exists game_entries (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  entry_type entry_type not null default 'newbie',
  amount_due int not null default 30 check (amount_due >= 0),
  payment_claimed boolean not null default false,
  paid boolean not null default false,
  paid_at timestamptz,
  status entry_status not null default 'pending_payment',
  eliminated_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, player_id)
);

create table if not exists selection_windows (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  window_number int not null check (window_number >= 1),
  start_at timestamptz not null,
  end_at timestamptz not null,
  deadline_at timestamptz not null,
  status selection_window_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, window_number),
  check (end_at > start_at and deadline_at >= start_at)
);

-- Teams are a static catalog (20 teams), but stored for relational integrity and history.
create table if not exists teams (
  id text primary key,
  name text not null unique
);

create table if not exists fixtures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  game_id uuid not null references games(id) on delete cascade,
  window_id uuid not null references selection_windows(id) on delete cascade,
  kickoff_at timestamptz not null,
  home_team_id text not null references teams(id),
  away_team_id text not null references teams(id),
  status fixture_status not null default 'scheduled',
  check (home_team_id <> away_team_id)
);

create table if not exists selections (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  window_id uuid not null references selection_windows(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  team_id text,
  locked_at timestamptz,
  admin_corrected boolean not null default false,
  corrected_by uuid references players(id) on delete set null,
  correction_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (window_id, player_id),
  constraint unique_team_per_player_per_game unique (game_id, player_id, team_id)
);

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

-- Simple updated_at triggers
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_players_updated_at on players;
create trigger trg_players_updated_at before update on players
for each row execute procedure set_updated_at();

drop trigger if exists trg_game_entries_updated_at on game_entries;
create trigger trg_game_entries_updated_at before update on game_entries
for each row execute procedure set_updated_at();

drop trigger if exists trg_selection_windows_updated_at on selection_windows;
create trigger trg_selection_windows_updated_at before update on selection_windows
for each row execute procedure set_updated_at();

drop trigger if exists trg_selections_updated_at on selections;
create trigger trg_selections_updated_at before update on selections
for each row execute procedure set_updated_at();

-- Helper for admin RLS checks (security definer avoids policy recursion)
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.players
    where user_id = auth.uid() and is_admin = true
  );
$$ language sql security definer stable set search_path = public;

-- RLS placeholders (simple for now)
alter table players enable row level security;
alter table games enable row level security;
alter table game_entries enable row level security;
alter table selection_windows enable row level security;
alter table teams enable row level security;
alter table fixtures enable row level security;
alter table selections enable row level security;
alter table historical_results enable row level security;
alter table admin_actions enable row level security;

-- Policies (Milestone 2A)
-- Players: users can read, insert, and update only their own profile
drop policy if exists "players_read_all" on players;
drop policy if exists "players_select_own" on players;
create policy "players_select_own" on players for select
using (auth.uid() = user_id);

drop policy if exists "players_insert_own" on players;
create policy "players_insert_own" on players for insert
with check (auth.uid() = user_id);

drop policy if exists "players_update_own" on players;
create policy "players_update_own" on players for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Placeholder for later: admins can read all player profiles
drop policy if exists "players_select_admin" on players;
create policy "players_select_admin" on players for select
using (public.is_admin());

-- Games readable by all authenticated users
drop policy if exists "games_read_all" on games;
create policy "games_read_all" on games for select using (true);

-- Game entries: users can read/insert/update own entry (update only when not paid)
drop policy if exists "game_entries_select_own" on game_entries;
create policy "game_entries_select_own" on game_entries for select
using (
  auth.uid() = (select user_id from players where players.id = game_entries.player_id)
);

drop policy if exists "game_entries_insert_own" on game_entries;
create policy "game_entries_insert_own" on game_entries for insert
with check (
  auth.uid() = (select user_id from players where players.id = game_entries.player_id)
);

drop policy if exists "game_entries_update_own" on game_entries;
create policy "game_entries_update_own" on game_entries for update
using (
  auth.uid() = (select user_id from players where players.id = game_entries.player_id)
  and paid = false
)
with check (
  auth.uid() = (select user_id from players where players.id = game_entries.player_id)
  and paid = false
);

-- Game entries: admins can read and update all entries
drop policy if exists "game_entries_select_admin" on game_entries;
create policy "game_entries_select_admin" on game_entries for select
using (public.is_admin());

drop policy if exists "game_entries_update_admin" on game_entries;
create policy "game_entries_update_admin" on game_entries for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "game_entries_read_all" on game_entries;
create policy "game_entries_read_all" on game_entries for select using (true);

drop policy if exists "players_read_authenticated" on players;
create policy "players_read_authenticated" on players for select using (auth.uid() is not null);

drop policy if exists "players_read_all" on players;
create policy "players_read_all" on players for select using (true);

drop policy if exists "selection_windows_read_all" on selection_windows;
create policy "selection_windows_read_all" on selection_windows for select using (true);

drop policy if exists "selection_windows_insert_admin" on selection_windows;
create policy "selection_windows_insert_admin" on selection_windows for insert
with check (public.is_admin());

drop policy if exists "selection_windows_update_admin" on selection_windows;
create policy "selection_windows_update_admin" on selection_windows for update
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "teams_read_all" on teams;
create policy "teams_read_all" on teams for select using (true);

drop policy if exists "fixtures_read_all" on fixtures;
create policy "fixtures_read_all" on fixtures for select using (true);

drop policy if exists "selections_read_all" on selections;
create policy "selections_read_all" on selections for select using (true);

drop policy if exists "selections_insert_own" on selections;
create policy "selections_insert_own" on selections for insert
with check (auth.uid() = (select user_id from players where players.id = selections.player_id));

drop policy if exists "selections_update_own" on selections;
create policy "selections_update_own" on selections for update
using (
  auth.uid() = (select user_id from players where players.id = selections.player_id)
  and locked_at is null
)
with check (
  auth.uid() = (select user_id from players where players.id = selections.player_id)
  and locked_at is null
);

drop policy if exists "selections_update_admin" on selections;
create policy "selections_update_admin" on selections for update
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "historical_results_read_all" on historical_results;
create policy "historical_results_read_all" on historical_results for select using (true);

-- Seed Game 27 (run once; safe to re-run with on conflict)
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
  opened_at
)
values (
  27,
  '2026/27',
  'open',
  10,
  30,
  20,
  1920,
  1920,
  'none',
  now()
)
on conflict (game_number) do update set
  season = excluded.season,
  status = excluded.status,
  standard_entry_fee = excluded.standard_entry_fee,
  newbie_entry_fee = excluded.newbie_entry_fee,
  rollover_contribution = excluded.rollover_contribution,
  opening_pot = excluded.opening_pot,
  current_pot = excluded.current_pot,
  result_type = excluded.result_type;

commit;

