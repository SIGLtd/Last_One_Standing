-- Restore selections audit columns required by submit_selection (migration 3a intent).
-- Production had migration 4 RPC deployed without these columns on public.selections.

begin;

alter table selections add column if not exists admin_corrected boolean not null default false;
alter table selections add column if not exists corrected_by uuid references players(id) on delete set null;
alter table selections add column if not exists correction_reason text;

commit;
