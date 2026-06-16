-- Milestone 3A: selection windows and player picks
-- Safe migration for live databases that already have selection_windows with:
--   opens_at, locks_at, status selection_window_status (upcoming, open, locked, complete, cancelled)
--
-- Adds app-facing columns (start_at, end_at, deadline_at) alongside legacy columns.
-- Does not drop selection_windows, legacy columns, or existing enum values.

begin;

-- 1. Extend existing enum with new values (keep upcoming, complete, cancelled)
do $$ begin
  alter type selection_window_status add value if not exists 'pending';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type selection_window_status add value if not exists 'resolving';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type selection_window_status add value if not exists 'resolved';
exception when duplicate_object then null; end $$;

-- 2. Add new columns if not exists
alter table selection_windows add column if not exists start_at timestamptz;
alter table selection_windows add column if not exists end_at timestamptz;
alter table selection_windows add column if not exists deadline_at timestamptz;
alter table selection_windows add column if not exists updated_at timestamptz default now();

-- Ensure updated_at has a default on existing column
alter table selection_windows alter column updated_at set default now();

-- 3. Backfill new columns from legacy columns
update selection_windows
set
  start_at = coalesce(start_at, opens_at),
  deadline_at = coalesce(deadline_at, locks_at),
  end_at = coalesce(end_at, locks_at + interval '3 days')
where start_at is null
   or deadline_at is null
   or end_at is null;

-- Map legacy status values to app-facing values where helpful (enum values preserved)
update selection_windows
set status = 'pending'::selection_window_status
where status = 'upcoming'::selection_window_status;

update selection_windows
set status = 'resolved'::selection_window_status
where status = 'complete'::selection_window_status;

update selection_windows
set status = 'pending'::selection_window_status
where status = 'cancelled'::selection_window_status;

-- 4. Trigger: keep legacy and app columns in sync; ensure end_at is populated
create or replace function public.sync_selection_window_timestamps()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    new.opens_at := coalesce(new.opens_at, new.start_at);
    new.start_at := coalesce(new.start_at, new.opens_at);
    new.locks_at := coalesce(new.locks_at, new.deadline_at);
    new.deadline_at := coalesce(new.deadline_at, new.locks_at);
  else
    if new.start_at is distinct from old.start_at then
      new.opens_at := new.start_at;
    elsif new.opens_at is distinct from old.opens_at then
      new.start_at := new.opens_at;
    end if;

    if new.deadline_at is distinct from old.deadline_at then
      new.locks_at := new.deadline_at;
    elsif new.locks_at is distinct from old.locks_at then
      new.deadline_at := new.locks_at;
    end if;
  end if;

  if new.end_at is null then
    new.end_at := coalesce(new.locks_at, new.deadline_at, new.opens_at, new.start_at, now()) + interval '3 days';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_selection_windows_sync_timestamps on selection_windows;
create trigger trg_selection_windows_sync_timestamps
before insert or update on selection_windows
for each row execute procedure public.sync_selection_window_timestamps();

drop trigger if exists trg_selection_windows_updated_at on selection_windows;
create trigger trg_selection_windows_updated_at
before update on selection_windows
for each row execute procedure set_updated_at();

-- Re-run sync on backfilled rows so legacy columns match new columns
update selection_windows
set
  start_at = coalesce(start_at, opens_at),
  opens_at = coalesce(opens_at, start_at),
  deadline_at = coalesce(deadline_at, locks_at),
  locks_at = coalesce(locks_at, deadline_at),
  end_at = coalesce(end_at, coalesce(locks_at, deadline_at) + interval '3 days')
where true;

-- Selections table updates (unchanged from 3A)
alter table selections drop constraint if exists selections_team_id_fkey;
alter table selections drop column if exists status;

alter table selections add column if not exists admin_corrected boolean not null default false;
alter table selections add column if not exists corrected_by uuid references players(id) on delete set null;
alter table selections add column if not exists correction_reason text;

alter table selections alter column team_id drop not null;

-- RLS: readable game entries for current picks visibility
drop policy if exists "game_entries_read_all" on game_entries;
create policy "game_entries_read_all" on game_entries for select using (true);

-- RLS: player display names for picks board
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

-- Note: opens_at and locks_at are retained for backward compatibility.
-- The app reads start_at, end_at, and deadline_at; the sync trigger keeps both sets aligned.
-- Deadline enforcement is primarily client-side in Milestone 3A.
