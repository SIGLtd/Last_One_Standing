-- Milestone 2B migration for existing databases
-- Run in Supabase SQL Editor if you already applied Milestone 1/2A schema.

begin;

-- New enums
do $$ begin
  create type entry_type as enum ('existing','newbie','admin_comp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type entry_status as enum ('pending_payment','active','eliminated','winner','withdrawn');
exception when duplicate_object then null; end $$;

-- Replace games table structure (backup data first if needed)
drop table if exists game_entries cascade;

alter table games drop column if exists pot_gbp;
alter table games drop column if exists notes;

alter table games add column if not exists season text;
alter table games add column if not exists standard_entry_fee int not null default 10;
alter table games add column if not exists newbie_entry_fee int not null default 30;
alter table games add column if not exists rollover_contribution int not null default 20;
alter table games add column if not exists opening_pot int not null default 0;
alter table games add column if not exists current_pot int not null default 0;
alter table games add column if not exists winner_player_id uuid references players(id) on delete set null;
alter table games add column if not exists result_type text not null default 'none';
alter table games add column if not exists opened_at timestamptz;
alter table games add column if not exists closed_at timestamptz;

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

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.players
    where user_id = auth.uid() and is_admin = true
  );
$$ language sql security definer stable set search_path = public;

drop trigger if exists trg_game_entries_updated_at on game_entries;
create trigger trg_game_entries_updated_at before update on game_entries
for each row execute procedure set_updated_at();

alter table game_entries enable row level security;

drop policy if exists "players_select_admin" on players;
create policy "players_select_admin" on players for select using (public.is_admin());

drop policy if exists "game_entries_select_own" on game_entries;
create policy "game_entries_select_own" on game_entries for select
using (auth.uid() = (select user_id from players where players.id = game_entries.player_id));

drop policy if exists "game_entries_insert_own" on game_entries;
create policy "game_entries_insert_own" on game_entries for insert
with check (auth.uid() = (select user_id from players where players.id = game_entries.player_id));

drop policy if exists "game_entries_update_own" on game_entries;
create policy "game_entries_update_own" on game_entries for update
using (
  auth.uid() = (select user_id from players where players.id = game_entries.player_id) and paid = false
)
with check (
  auth.uid() = (select user_id from players where players.id = game_entries.player_id) and paid = false
);

drop policy if exists "game_entries_select_admin" on game_entries;
create policy "game_entries_select_admin" on game_entries for select using (public.is_admin());

drop policy if exists "game_entries_update_admin" on game_entries;
create policy "game_entries_update_admin" on game_entries for update
using (public.is_admin()) with check (public.is_admin());

insert into games (
  game_number, season, status, standard_entry_fee, newbie_entry_fee,
  rollover_contribution, opening_pot, current_pot, result_type, opened_at
)
values (27, '2026/27', 'open', 10, 30, 20, 1920, 1920, 'none', now())
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

-- To grant admin access to a player:
-- update players set is_admin = true where email = 'your-admin@example.com';
