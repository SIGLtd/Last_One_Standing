import { createClient } from '@supabase/supabase-js'
import { loadLocalEnv, requireEnv } from './lib/loadLocalEnv'

async function main() {
  loadLocalEnv()
  const supabaseUrl = requireEnv('SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const admin = createClient(supabaseUrl, serviceKey)

  const { data: fixtures, error: fixtureError } = await admin
    .from('season_fixtures')
    .select('canonical_key, home_team_id, away_team_id, kickoff_at')
    .eq('season', '2026/27')

  if (fixtureError) throw fixtureError

  const homeCounts: Record<string, number> = {}
  const awayCounts: Record<string, number> = {}
  const keys = new Set<string>()

  for (const row of fixtures ?? []) {
    keys.add(row.canonical_key)
    homeCounts[row.home_team_id] = (homeCounts[row.home_team_id] ?? 0) + 1
    awayCounts[row.away_team_id] = (awayCounts[row.away_team_id] ?? 0) + 1
  }

  const teams = new Set((fixtures ?? []).flatMap((f) => [f.home_team_id, f.away_team_id]))
  const duplicateKeys = (fixtures ?? []).length - keys.size

  const { data: game } = await admin.from('games').select('*').eq('game_number', 27).maybeSingle()
  const { data: windows } = await admin
    .from('selection_windows')
    .select('id, window_number, status')
    .eq('game_id', game?.id ?? '')
    .order('window_number')

  const { data: selections, count: selectionCount } = await admin
    .from('selections')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', game?.id ?? '')

  const { data: benClarky } = await admin
    .from('players')
    .select('id, display_name, is_admin')
    .eq('is_admin', true)
    .in('display_name', ['Ben Stephens', 'Clarky'])

  const adminChecks = []
  for (const player of benClarky ?? []) {
    const { data: entry } = await admin
      .from('game_entries')
      .select('paid, status')
      .eq('game_id', game?.id ?? '')
      .eq('player_id', player.id)
      .maybeSingle()
    adminChecks.push({
      display_name: player.display_name,
      is_admin: player.is_admin,
      paid: entry?.paid ?? false,
      status: entry?.status ?? null,
    })
  }

  const { data: syncRuns } = await admin
    .from('fixture_sync_runs')
    .select('id, source_type, run_result, fixture_total, created_at')
    .order('created_at', { ascending: false })
    .limit(3)

  const { count: mappedProviderIds } = await admin
    .from('season_fixtures')
    .select('*', { count: 'exact', head: true })
    .eq('season', '2026/27')
    .not('source_fixture_id', 'is', null)

  const teamBalanceErrors: string[] = []
  for (const teamId of teams) {
    const home = homeCounts[teamId] ?? 0
    const away = awayCounts[teamId] ?? 0
    if (home !== 19 || away !== 19 || home + away !== 38) {
      teamBalanceErrors.push(`${teamId}: home=${home} away=${away}`)
    }
  }

  console.log('PRODUCTION VERIFICATION')
  console.log('=======================')
  console.log(JSON.stringify({
    season_fixtures_count: fixtures?.length ?? 0,
    team_count: teams.size,
    duplicate_canonical_keys: duplicateKeys,
    team_balance_errors: teamBalanceErrors,
    game_27: game
      ? { status: game.status, season: game.season, opening_pot: game.opening_pot, current_pot: game.current_pot }
      : null,
    selection_windows: windows,
    selections_count: selectionCount ?? selections?.length ?? 0,
    admins: adminChecks,
    provider_mapped_fixture_ids: mappedProviderIds ?? 0,
    recent_sync_runs: syncRuns,
    window_2_or_later: (windows ?? []).filter((w) => w.window_number >= 2).length,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
