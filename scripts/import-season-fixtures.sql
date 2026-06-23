-- Production season fixture import (CEO approval required before execution)
-- Source artefact: data/fixtures/2026-27/fixtures.json
-- Run only after: npm run validate:fixtures && npm run import:fixtures:dry-run
--
-- This script is a template. Generate row statements from fixtures.json using:
--   npm run generate:import-sql
--
-- Preserves Game 27, Window 1, and all existing game_entries.

begin;

insert into fixture_sync_runs (
  source_type,
  source_url,
  validation_status,
  run_result,
  fixture_total
) values (
  'official_import',
  'https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season/',
  'passed',
  'official_import_template',
  380
);

-- Example row shape (repeat for all 380 fixtures from fixtures.json):
-- insert into season_fixtures (
--   season, source_fixture_id, canonical_key, home_team_id, away_team_id,
--   kickoff_at, original_kickoff_at, status, source_name, source_url, source_retrieved_at
-- ) values (
--   '2026/27', null, '2026/27|ars|cov|2026-08-21', 'ars', 'cov',
--   '2026-08-21T19:00:00.000Z', '2026-08-21T19:00:00.000Z', 'scheduled',
--   'premier_league_official',
--   'https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season/',
--   now()
-- ) on conflict (season, canonical_key) do update set
--   kickoff_at = excluded.kickoff_at,
--   last_changed_at = case when season_fixtures.kickoff_at <> excluded.kickoff_at then now() else season_fixtures.last_changed_at end,
--   rescheduled_count = case when season_fixtures.kickoff_at <> excluded.kickoff_at then season_fixtures.rescheduled_count + 1 else season_fixtures.rescheduled_count end;

rollback;
