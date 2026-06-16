-- Last One Standing (Premier League survival pool) - Milestone 1 draft schema
-- Notes:
-- - Keep policies simple for now; tighten later.
-- - No external football APIs yet; fixtures/results can be entered manually.

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
  create type selection_window_status as enum ('upcoming','open','locked','complete','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type selection_status as enum ('no_pick','submitted','locked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fixture_status as enum ('scheduled','in_play','finished','postponed');
exception when duplicate_object then null; end $$;

-- Core tables
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  auth_user_id uuid unique, -- links to auth.users.id
  display_name text not null check (char_length(display_name) >= 2),
  phone_number text not null check (char_length(phone_number) >= 6),
  email text not null,
  is_admin boolean not null default false,
  status text not null default 'active' check (status in ('active','inactive'))
);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  game_number int not null unique check (game_number >= 1),
  pot_gbp int not null default 0 check (pot_gbp >= 0),
  status game_status not null default 'off_season',
  notes text
);

create table if not exists game_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  entry_type text not null check (entry_type in ('returning','new')),
  amount_due_gbp int not null check (amount_due_gbp >= 0),
  amount_paid_gbp int not null default 0 check (amount_paid_gbp >= 0),
  payment_status payment_status not null default 'unpaid',
  unique (game_id, player_id)
);

create table if not exists selection_windows (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  game_id uuid not null references games(id) on delete cascade,
  window_number int not null check (window_number >= 1),
  opens_at timestamptz not null,
  locks_at timestamptz not null,
  status selection_window_status not null default 'upcoming',
  unique (game_id, window_number),
  check (locks_at > opens_at)
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  game_id uuid not null references games(id) on delete cascade,
  window_id uuid not null references selection_windows(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  team_id text references teams(id),
  status selection_status not null default 'no_pick',
  locked_at timestamptz,

  -- one selection per player per window
  unique (window_id, player_id),

  -- no duplicate selected team per player per game (when team_id is set)
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

drop trigger if exists trg_selections_updated_at on selections;
create trigger trg_selections_updated_at before update on selections
for each row execute procedure set_updated_at();

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

-- Policies (draft)
-- Players: users can read everyone; update only their own profile (by auth_user_id)
drop policy if exists "players_read_all" on players;
create policy "players_read_all" on players for select using (true);

drop policy if exists "players_update_own" on players;
create policy "players_update_own" on players for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

-- Most other tables: readable by all for now (private group); writes reserved for service role/admin later
drop policy if exists "games_read_all" on games;
create policy "games_read_all" on games for select using (true);

drop policy if exists "selection_windows_read_all" on selection_windows;
create policy "selection_windows_read_all" on selection_windows for select using (true);

drop policy if exists "teams_read_all" on teams;
create policy "teams_read_all" on teams for select using (true);

drop policy if exists "fixtures_read_all" on fixtures;
create policy "fixtures_read_all" on fixtures for select using (true);

drop policy if exists "selections_read_all" on selections;
create policy "selections_read_all" on selections for select using (true);

drop policy if exists "historical_results_read_all" on historical_results;
create policy "historical_results_read_all" on historical_results for select using (true);

-- Selection writes: allow authenticated users to upsert their own selection rows (simple MVP)
drop policy if exists "selections_insert_own" on selections;
create policy "selections_insert_own" on selections for insert
with check (auth.uid() = (select auth_user_id from players where players.id = selections.player_id));

drop policy if exists "selections_update_own" on selections;
create policy "selections_update_own" on selections for update
using (auth.uid() = (select auth_user_id from players where players.id = selections.player_id))
with check (auth.uid() = (select auth_user_id from players where players.id = selections.player_id));

commit;

