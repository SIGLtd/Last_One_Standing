/**
 * Publish Game 27 Window 2 as Round 1 using controlled RPCs only.
 * Requires LOS_ADMIN_EMAIL and LOS_ADMIN_PASSWORD in .env.local
 */
import { createClient } from '@supabase/supabase-js'
import { loadLocalEnv, requireEnv } from './lib/loadLocalEnv'
import { validateRound1PublicationGate } from '../src/lib/round1Publication'
import type { SelectionWindowEligibleFixture, SelectionWindowWithMeta, SeasonFixture } from '../src/types'

loadLocalEnv()

const url = requireEnv('VITE_SUPABASE_URL')
const anonKey = requireEnv('VITE_SUPABASE_ANON_KEY')
const adminEmail = requireEnv('LOS_ADMIN_EMAIL')
const adminPassword = requireEnv('LOS_ADMIN_PASSWORD')

async function main() {
  const client = createClient(url, anonKey)

  const { error: signInError } = await client.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  })
  if (signInError) {
    console.error('Admin sign-in failed:', signInError.message)
    process.exit(1)
  }

  const { data: game, error: gameError } = await client
    .from('games')
    .select('*')
    .eq('game_number', 27)
    .maybeSingle()
  if (gameError || !game) {
    console.error('Game 27 not found')
    process.exit(1)
  }

  const { data: windows, error: windowsError } = await client
    .from('selection_windows')
    .select('*')
    .eq('game_id', game.id)
    .order('window_number', { ascending: true })
  if (windowsError) {
    console.error('Failed to load windows:', windowsError.message)
    process.exit(1)
  }

  const window2 = (windows as SelectionWindowWithMeta[]).find((row) => row.window_number === 2)
  if (!window2) {
    console.error('Window 2 not found')
    process.exit(1)
  }

  if (window2.status === 'open') {
    console.log('Window 2 is already open — skipping publication.')
    await printState(client, game.id, window2.id)
    return
  }

  const { error: refreshError } = await client.rpc('refresh_pending_window_snapshots', {
    p_window_id: window2.id,
  })
  if (refreshError) {
    console.error('Revalidation failed:', refreshError.message)
    process.exit(1)
  }

  const { data: refreshedWindow, error: refreshLoadError } = await client
    .from('selection_windows')
    .select('*')
    .eq('id', window2.id)
    .single()
  if (refreshLoadError || !refreshedWindow) {
    console.error('Failed to reload window after revalidation')
    process.exit(1)
  }

  const { data: seasonFixtures, error: seasonError } = await client
    .from('season_fixtures')
    .select('*')
    .eq('season', game.season)
  if (seasonError) {
    console.error('Failed to load season fixtures:', seasonError.message)
    process.exit(1)
  }

  const { data: snapshotFixtures, error: snapshotError } = await client
    .from('selection_window_eligible_fixtures')
    .select('*')
    .eq('window_id', window2.id)
    .order('kickoff_at', { ascending: true })
  if (snapshotError) {
    console.error('Failed to load snapshot fixtures:', snapshotError.message)
    process.exit(1)
  }

  const gate = validateRound1PublicationGate({
    seasonFixtures: (seasonFixtures ?? []) as SeasonFixture[],
    snapshotFixtures: (snapshotFixtures ?? []) as SelectionWindowEligibleFixture[],
    window: refreshedWindow as SelectionWindowWithMeta,
    allWindows: (windows ?? []) as SelectionWindowWithMeta[],
  })

  if (!gate.passed) {
    console.error('Publication gate failed:')
    for (const discrepancy of gate.discrepancies) {
      console.error(`- ${discrepancy}`)
    }
    process.exit(1)
  }

  console.log('Publication gate passed.')
  console.log('Approved fixtures:')
  for (const fixture of gate.approvedFixtures) {
    console.log(`- ${fixture.label}`)
  }
  console.log(`Deadline (UTC): ${gate.deadlineUtc}`)

  const { data: approved, error: approveError } = await client.rpc('admin_approve_selection_window', {
    p_window_id: window2.id,
  })
  if (approveError) {
    console.error('Approval RPC failed:', approveError.message)
    process.exit(1)
  }

  console.log('Window 2 approved and opened.')
  console.log(JSON.stringify(approved, null, 2))
  await printState(client, game.id, window2.id)
}

async function printState(
  client: ReturnType<typeof createClient>,
  gameId: string,
  windowId: string,
) {
  const { data: window } = await client.from('selection_windows').select('*').eq('id', windowId).single()
  const { count } = await client
    .from('selection_window_eligible_fixtures')
    .select('*', { count: 'exact', head: true })
    .eq('window_id', windowId)
  const { count: selectionCount } = await client
    .from('selections')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', gameId)

  console.log(
    JSON.stringify(
      {
        window_status: window?.status,
        approved_at: window?.approved_at,
        snapshot_fixtures: count,
        selections: selectionCount,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
