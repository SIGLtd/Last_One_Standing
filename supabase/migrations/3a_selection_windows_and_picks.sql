-- Milestone 3A: selection windows and player picks
-- Run in Supabase SQL Editor after Milestone 2B migration.

begin;

-- Replace selection window status enum
do $$ begin
  create type selection_window_status_v3 as enum ('pending','open','locked','resolving','resolved');
exception when duplicate_object then null; end $$;

-- Rebuild selection_windows for new column layout
alter table if exists selection_windows drop constraint if exists selection_windows_game_id_window_number_key;

-- Migrate existing windows if present (best-effort)
alter table selection_windows add column if not exists start_at timestamptz;
alter table selection_windows add column if not exists end_at timestamptz;
alter table selection_windows add column if not exists deadline_at timestamptz;
alter table selection_windows add column if not exists updated_at timestamptz not null default now();

update selection_windows
set
  start_at = coalesce(start_at, opens_at, now()),
  end_at = coalesce(end_at, locks_at, now() + interval '2 days'),
  deadline_at = coalesce(deadline_at, locks_at, now() + interval '1 day')
where start_at is null or end_at is null or deadline_at is null;

alter table selection_windows drop column if exists opens_at;
alter table selection_windows drop column if exists locks_at;

alter table selection_windows alter column start_at set not null;
alter table selection_windows alter column end_at set not null;
alter table selection_windows alter column deadline_at set not null;

-- Status column: convert to text first if enum mismatch, then to new enum
alter table selection_windows alter column status drop default;
alter table selection_windows alter column status type text using status::text;

update selection_windows
set status = case
  when status in ('upcoming') then 'pending'
  when status in ('complete') then 'resolved'
  when status in ('cancelled') then 'pending'
  else status
end;

alter table selection_windows
  alter column status type selection_window_status_v3
  using status::selection_window_status_v3;

alter table selection_windows alter column status set default 'pending';

drop type if exists selection_window_status cascade;
alter type selection_window_status_v3 rename to selection_window_status;

alter table selection_windows drop constraint if exists selection_windows_game_id_window_number_key;
alter table selection_windows add constraint selection_windows_game_id_window_number_key unique (game_id, window_number);

alter table selection_windows drop constraint if exists selection_windows_check;
alter table selection_windows add constraint selection_windows_check check (end_at > start_at and deadline_at >= start_at);

drop trigger if exists trg_selection_windows_updated_at on selection_windows;
create trigger trg_selection_windows_updated_at before update on selection_windows
for each row execute procedure set_updated_at();

-- Rebuild selections table fields
alter table selections drop constraint if exists selections_team_id_fkey;
alter table selections drop column if exists status;

alter table selections add column if not exists admin_corrected boolean not null default false;
alter table selections add column if not exists corrected_by uuid references players(id) on delete set null;
alter table selections add column if not exists correction_reason text;

alter table selections alter column team_id drop not null;

-- RLS: readable game entries for current picks visibility
drop policy if exists "game_entries_read_all" on game_entries;
create policy "game_entries_read_all" on game_entries for select using (true);

-- RLS: authenticated users can read player display names for picks board
drop policy if exists "players_read_authenticated" on players;
create policy "players_read_authenticated" on players for select using (auth.uid() is not null);

drop policy if exists "players_read_all" on players;
create policy "players_read_all" on players for select using (true);

-- Selection window admin policies
drop policy if exists "selection_windows_insert_admin" on selection_windows;
create policy "selection_windows_insert_admin" on selection_windows for insert
with check (public.is_admin());

drop policy if exists "selection_windows_update_admin" on selection_windows;
create policy "selection_windows_update_admin" on selection_windows for update
using (public.is_admin()) with check (public.is_admin());

-- Selection policies (deadline enforced client-side for MVP)
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

commit;

-- Note: deadline and window status enforcement is primarily client-side in Milestone 3A.
-- Server-side hardening can be added later via triggers or stricter RLS.
