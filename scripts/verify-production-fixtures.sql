-- Read-only production fixture verification (Game 27 safeguards)

select 'season_fixtures_count' as check_name, count(*)::int as value
from season_fixtures where season = '2026/27';

select 'team_count' as check_name, count(distinct team_id)::int as value
from (
  select home_team_id as team_id from season_fixtures where season = '2026/27'
  union
  select away_team_id from season_fixtures where season = '2026/27'
) t;

select 'duplicate_canonical_keys' as check_name, count(*)::int as value
from (
  select canonical_key
  from season_fixtures
  where season = '2026/27'
  group by canonical_key
  having count(*) > 1
) d;

select team_id,
  sum(home_g)::int as home_fixtures,
  sum(away_g)::int as away_fixtures,
  sum(home_g + away_g)::int as total_fixtures
from (
  select home_team_id as team_id, 1 as home_g, 0 as away_g
  from season_fixtures where season = '2026/27'
  union all
  select away_team_id, 0, 1
  from season_fixtures where season = '2026/27'
) x
group by team_id
order by team_id;

select game_number, status, season, opening_pot, current_pot
from games where game_number = 27;

select sw.window_number, sw.status, sw.eligible_sat_date, sw.eligible_sun_date, sw.review_outcome
from selection_windows sw
join games g on g.id = sw.game_id
where g.game_number = 27
order by window_number;

select count(*)::int as selections_count
from selections s
join games g on g.id = s.game_id
where g.game_number = 27;

select p.display_name, p.is_admin, ge.paid, ge.status
from players p
join game_entries ge on ge.player_id = p.id
join games g on g.id = ge.game_id
where g.game_number = 27 and p.is_admin = true
order by p.display_name;

select count(*)::int as provider_mapped_ids
from season_fixtures
where season = '2026/27' and source_fixture_id is not null;

select id, source_type, run_result, fixture_total, created_at
from fixture_sync_runs
order by created_at desc
limit 3;
