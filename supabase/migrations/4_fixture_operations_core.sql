-- Fixture Operations Core (Game 27 / 2026-27 season)
-- Preserves existing selection_windows (incl. Window 1 placeholder) and game_entries.

begin;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type fixture_sync_source as enum ('manual', 'official_import', 'api_football');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fixture_sync_status as enum ('running', 'passed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fixture_change_type as enum (
    'kickoff_change', 'status_change', 'day_move', 'cancelled', 'postponed', 'count_mismatch', 'team_pair_change'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type fixture_change_resolution as enum ('pending', 'acknowledged', 'resolved', 'ignored');
exception when duplicate_object then null; end $$;

do $$ begin
  alter type fixture_status add value if not exists 'cancelled';
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Teams seed (2026/27 Premier League) — upsert only, no deletes
-- ---------------------------------------------------------------------------
insert into teams (id, name) values
  ('ars', 'Arsenal'),
  ('avl', 'Aston Villa'),
  ('bou', 'AFC Bournemouth'),
  ('bre', 'Brentford'),
  ('bha', 'Brighton & Hove Albion'),
  ('che', 'Chelsea'),
  ('cov', 'Coventry City'),
  ('cry', 'Crystal Palace'),
  ('eve', 'Everton'),
  ('ful', 'Fulham'),
  ('hul', 'Hull City'),
  ('ips', 'Ipswich Town'),
  ('lee', 'Leeds United'),
  ('liv', 'Liverpool'),
  ('mci', 'Manchester City'),
  ('mun', 'Manchester United'),
  ('new', 'Newcastle United'),
  ('nfo', 'Nottingham Forest'),
  ('sun', 'Sunderland'),
  ('tot', 'Tottenham Hotspur')
on conflict (id) do update set name = excluded.name;

-- ---------------------------------------------------------------------------
-- season_fixtures (master list)
-- ---------------------------------------------------------------------------
create table if not exists season_fixtures (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  source_fixture_id text,
  canonical_key text not null,
  home_team_id text not null references teams(id),
  away_team_id text not null references teams(id),
  kickoff_at timestamptz not null,
  original_kickoff_at timestamptz not null,
  status fixture_status not null default 'scheduled',
  home_score int,
  away_score int,
  result_status text not null default 'pending',
  source_name text not null default 'premier_league_official',
  source_url text,
  source_retrieved_at timestamptz,
  import_batch_id uuid,
  rescheduled_count int not null default 0,
  last_changed_at timestamptz,
  eligibility_override text not null default 'none' check (eligibility_override in ('none', 'force_eligible', 'force_ineligible')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id),
  unique (season, canonical_key)
);

create unique index if not exists season_fixtures_source_id_idx
  on season_fixtures (season, source_fixture_id)
  where source_fixture_id is not null;

create index if not exists season_fixtures_kickoff_idx on season_fixtures (season, kickoff_at);

-- ---------------------------------------------------------------------------
-- fixture_sync_runs
-- ---------------------------------------------------------------------------
create table if not exists fixture_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_type fixture_sync_source not null,
  source_url text,
  retrieved_at timestamptz not null default now(),
  validation_status fixture_sync_status not null default 'running',
  run_result text not null,
  fixture_total int not null default 0,
  changes_detected int not null default 0,
  error_summary text,
  game_id uuid references games(id) on delete set null,
  target_sat_date date,
  target_sun_date date,
  created_by_player_id uuid references players(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- fixture_change_events
-- ---------------------------------------------------------------------------
create table if not exists fixture_change_events (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references fixture_sync_runs(id) on delete cascade,
  season_fixture_id uuid references season_fixtures(id) on delete set null,
  change_type fixture_change_type not null,
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  affects_open_window boolean not null default false,
  affected_window_id uuid references selection_windows(id) on delete set null,
  resolution_status fixture_change_resolution not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists fixture_change_events_window_idx on fixture_change_events (affected_window_id, resolution_status);

-- ---------------------------------------------------------------------------
-- Extend selection_windows (candidate + approved windows)
-- ---------------------------------------------------------------------------
alter table selection_windows add column if not exists eligible_sat_date date;
alter table selection_windows add column if not exists eligible_sun_date date;
alter table selection_windows add column if not exists review_outcome text check (review_outcome in ('deferred', 'rejected'));
alter table selection_windows add column if not exists sync_run_id uuid references fixture_sync_runs(id) on delete set null;
alter table selection_windows add column if not exists earliest_kickoff_at timestamptz;
alter table selection_windows add column if not exists approved_at timestamptz;
alter table selection_windows add column if not exists approved_by_player_id uuid references players(id) on delete set null;

create unique index if not exists selection_windows_game_weekend_idx
  on selection_windows (game_id, eligible_sat_date, eligible_sun_date)
  where eligible_sat_date is not null and eligible_sun_date is not null and review_outcome is null;

-- ---------------------------------------------------------------------------
-- Approved fixture snapshot (auditable denormalised copy)
-- ---------------------------------------------------------------------------
create table if not exists selection_window_eligible_fixtures (
  id uuid primary key default gen_random_uuid(),
  window_id uuid not null references selection_windows(id) on delete cascade,
  season_fixture_id uuid not null references season_fixtures(id) on delete restrict,
  home_team_id text not null,
  away_team_id text not null,
  home_team_name text not null,
  away_team_name text not null,
  kickoff_at timestamptz not null,
  snapshot_kickoff_at timestamptz not null,
  fixture_status fixture_status not null,
  created_at timestamptz not null default now(),
  unique (window_id, season_fixture_id)
);

create index if not exists swef_window_idx on selection_window_eligible_fixtures (window_id);
create index if not exists swef_team_idx on selection_window_eligible_fixtures (window_id, home_team_id, away_team_id);

-- ---------------------------------------------------------------------------
-- selections: link to snapshot fixture; drop premature team-reuse constraint
-- ---------------------------------------------------------------------------
alter table selections add column if not exists season_fixture_id uuid references season_fixtures(id) on delete set null;

alter table selections drop constraint if exists unique_team_per_player_per_game;

drop trigger if exists trg_season_fixtures_updated_at on season_fixtures;
create trigger trg_season_fixtures_updated_at before update on season_fixtures
for each row execute procedure set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.london_date(p_ts timestamptz)
returns date as $$
  select (p_ts at time zone 'Europe/London')::date;
$$ language sql immutable;

create or replace function public.london_isodow(p_ts timestamptz)
returns int as $$
  select extract(isodow from (p_ts at time zone 'Europe/London'))::int;
$$ language sql immutable;

create or replace function public.is_standard_eligible_fixture(p_kickoff timestamptz, p_override text, p_status fixture_status)
returns boolean as $$
  select
    p_status in ('scheduled', 'in_play')
    and (
      p_override = 'force_eligible'
      or (p_override = 'none' and public.london_isodow(p_kickoff) in (6, 7))
    )
    and p_override <> 'force_ineligible';
$$ language sql immutable;

create or replace function public.is_team_finally_used(p_game_id uuid, p_player_id uuid, p_team_id text)
returns boolean as $$
  select exists (
    select 1
    from selections s
    join selection_windows sw on sw.id = s.window_id
    where s.game_id = p_game_id
      and s.player_id = p_player_id
      and s.team_id = p_team_id
      and s.team_id is not null
      and sw.window_number >= 2
      and (
        sw.status in ('locked', 'resolved')
        or (sw.deadline_at <= now() and s.team_id is not null)
      )
  );
$$ language sql stable;

create or replace function public.pick_error(p_code text)
returns void as $$
begin
  raise exception '%', p_code using errcode = 'P0001';
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- submit_selection RPC
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- admin_lock_selection_window
-- ---------------------------------------------------------------------------
create or replace function public.admin_lock_selection_window(p_window_id uuid)
returns selection_windows as $$
declare
  v_window selection_windows%rowtype;
  v_actor uuid;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select id into v_actor from players where user_id = auth.uid();

  select * into v_window from selection_windows where id = p_window_id;
  if v_window.id is null then
    raise exception 'WINDOW_NOT_FOUND';
  end if;

  if v_window.window_number = 1 then
    raise exception 'WINDOW_1_PROTECTED';
  end if;

  update selection_windows
  set status = 'locked', updated_at = now()
  where id = p_window_id
  returning * into v_window;

  update selections
  set locked_at = now(), updated_at = now()
  where window_id = p_window_id and team_id is not null and locked_at is null;

  return v_window;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- Validate candidate: no team in multiple eligible fixtures
-- ---------------------------------------------------------------------------
create or replace function public.candidate_has_duplicate_teams(p_window_id uuid)
returns boolean as $$
  select exists (
    select team_id
    from (
      select home_team_id as team_id from selection_window_eligible_fixtures where window_id = p_window_id
      union all
      select away_team_id from selection_window_eligible_fixtures where window_id = p_window_id
    ) t
    group by team_id
    having count(*) > 1
  );
$$ language sql stable;

-- ---------------------------------------------------------------------------
-- admin_approve_selection_window
-- ---------------------------------------------------------------------------
create or replace function public.admin_approve_selection_window(p_window_id uuid)
returns selection_windows as $$
declare
  v_window selection_windows%rowtype;
  v_actor uuid;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select id into v_actor from players where user_id = auth.uid();

  select * into v_window from selection_windows where id = p_window_id;
  if v_window.id is null then
    raise exception 'WINDOW_NOT_FOUND';
  end if;

  if v_window.status <> 'pending' then
    raise exception 'WINDOW_NOT_PENDING';
  end if;

  if v_window.window_number = 1 then
    raise exception 'WINDOW_1_PROTECTED';
  end if;

  if public.candidate_has_duplicate_teams(p_window_id) then
    raise exception 'DUPLICATE_TEAM_IN_WINDOW';
  end if;

  update selection_windows
  set
    status = 'open',
    approved_at = now(),
    approved_by_player_id = v_actor,
    review_outcome = null,
    updated_at = now()
  where id = p_window_id
  returning * into v_window;

  return v_window;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_review_selection_window(
  p_window_id uuid,
  p_outcome text
)
returns selection_windows as $$
declare
  v_window selection_windows%rowtype;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_outcome not in ('deferred', 'rejected') then
    raise exception 'INVALID_OUTCOME';
  end if;

  select * into v_window from selection_windows where id = p_window_id;
  if v_window.status <> 'pending' or v_window.window_number = 1 then
    raise exception 'INVALID_WINDOW';
  end if;

  update selection_windows
  set review_outcome = p_outcome, updated_at = now()
  where id = p_window_id
  returning * into v_window;

  return v_window;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- Build / refresh pending candidate window snapshot from master data
-- ---------------------------------------------------------------------------
create or replace function public.refresh_pending_window_snapshots(p_window_id uuid)
returns void as $$
declare
  v_window selection_windows%rowtype;
begin
  select * into v_window from selection_windows where id = p_window_id;
  if v_window.id is null or v_window.status <> 'pending' or v_window.window_number < 2 then
    return;
  end if;

  delete from selection_window_eligible_fixtures where window_id = p_window_id;

  insert into selection_window_eligible_fixtures (
    window_id, season_fixture_id, home_team_id, away_team_id,
    home_team_name, away_team_name, kickoff_at, snapshot_kickoff_at, fixture_status
  )
  select
    p_window_id,
    sf.id,
    sf.home_team_id,
    sf.away_team_id,
    ht.name,
    at.name,
    sf.kickoff_at,
    sf.kickoff_at,
    sf.status
  from season_fixtures sf
  join teams ht on ht.id = sf.home_team_id
  join teams at on at.id = sf.away_team_id
  where sf.season = (select season from games where id = v_window.game_id)
    and public.london_date(sf.kickoff_at) between v_window.eligible_sat_date and v_window.eligible_sun_date
    and public.is_standard_eligible_fixture(sf.kickoff_at, sf.eligibility_override, sf.status);

  select min(kickoff_at) into v_window.earliest_kickoff_at
  from selection_window_eligible_fixtures where window_id = p_window_id;

  if v_window.earliest_kickoff_at is not null then
    update selection_windows
    set
      earliest_kickoff_at = v_window.earliest_kickoff_at,
      deadline_at = v_window.earliest_kickoff_at - interval '1 hour',
      start_at = v_window.earliest_kickoff_at - interval '2 days',
      end_at = v_window.earliest_kickoff_at + interval '2 days',
      updated_at = now()
    where id = p_window_id;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table season_fixtures enable row level security;
alter table fixture_sync_runs enable row level security;
alter table fixture_change_events enable row level security;
alter table selection_window_eligible_fixtures enable row level security;

drop policy if exists "season_fixtures_read_all" on season_fixtures;
create policy "season_fixtures_read_all" on season_fixtures for select using (true);

drop policy if exists "swef_read_all" on selection_window_eligible_fixtures;
create policy "swef_read_all" on selection_window_eligible_fixtures for select using (true);

drop policy if exists "fixture_sync_runs_admin" on fixture_sync_runs;
create policy "fixture_sync_runs_admin" on fixture_sync_runs for select using (public.is_admin());
create policy "fixture_sync_runs_admin_insert" on fixture_sync_runs for insert with check (public.is_admin());

drop policy if exists "fixture_change_events_admin" on fixture_change_events;
create policy "fixture_change_events_admin" on fixture_change_events for select using (public.is_admin());

-- Block direct player writes to selections (RPC only)
drop policy if exists "selections_insert_own" on selections;
drop policy if exists "selections_update_own" on selections;

create policy "selections_insert_rpc_only" on selections for insert with check (false);
create policy "selections_update_rpc_only" on selections for update using (false);

drop policy if exists "selections_update_admin" on selections;
create policy "selections_update_admin" on selections for update using (public.is_admin()) with check (public.is_admin());

-- Grant execute on RPCs
grant execute on function public.submit_selection(uuid, text) to authenticated;
grant execute on function public.admin_lock_selection_window(uuid) to authenticated;
grant execute on function public.admin_approve_selection_window(uuid) to authenticated;
grant execute on function public.admin_review_selection_window(uuid, text) to authenticated;
grant execute on function public.refresh_pending_window_snapshots(uuid) to authenticated, service_role;

commit;
