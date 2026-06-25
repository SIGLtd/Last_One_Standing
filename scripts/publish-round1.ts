/**
 * Publish Game 27 Window 2 as Round 1 using controlled RPCs only.
 * Uses SUPABASE_SERVICE_ROLE_KEY for revalidation, then admin JWT for approval.
 * Optional: LOS_ADMIN_EMAIL + LOS_ADMIN_PASSWORD in .env.local
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadLocalEnv, requireEnv } from './lib/loadLocalEnv'
import { validateRound1PublicationGate } from '../src/lib/round1Publication'
import type { SelectionWindowEligibleFixture, SelectionWindowWithMeta, SeasonFixture } from '../src/types'

const __dirname = dirname(fileURLToPath(import.meta.url))

loadLocalEnv()

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!url) {
  console.error('Missing SUPABASE_URL or VITE_SUPABASE_URL')
  process.exit(1)
}

async function resolveServiceClient() {
  if (serviceKey) {
    return createClient(url!, serviceKey)
  }

  const cliPath = join(__dirname, '..', 'supabase', '.temp', 'project-ref')
  console.error(
    'Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local or run: npx supabase link (service role from dashboard).',
  )
  process.exit(1)
}

async function resolveAdminClient(serviceClient: ReturnType<typeof createClient>) {
  const adminEmail = process.env.LOS_ADMIN_EMAIL?.trim()
  const adminPassword = process.env.LOS_ADMIN_PASSWORD?.trim()

  if (adminEmail && adminPassword && anonKey) {
    const userClient = createClient(url!, anonKey)
    const { error } = await userClient.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
    if (error) {
      console.error('Admin sign-in failed:', error.message)
      process.exit(1)
    }
    return userClient
  }

  const { data: adminPlayer, error: adminError } = await serviceClient
    .from('players')
    .select('user_id, email')
    .eq('is_admin', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (adminError || !adminPlayer?.user_id) {
    console.error('No admin player found for approval fallback.')
    process.exit(1)
  }

  if (!anonKey) {
    console.error('Missing VITE_SUPABASE_ANON_KEY and LOS_ADMIN credentials.')
    process.exit(1)
  }

  console.error(
    `Set LOS_ADMIN_EMAIL and LOS_ADMIN_PASSWORD in .env.local to approve as ${adminPlayer.email ?? 'admin'}.`,
  )
  process.exit(1)
}

async function main() {
  const serviceClient = await resolveServiceClient()

  const { data: game, error: gameError } = await serviceClient
    .from('games')
    .select('*')
    .eq('game_number', 27)
    .maybeSingle()
  if (gameError || !game) {
    console.error('Game 27 not found')
    process.exit(1)
  }

  const { data: windows, error: windowsError } = await serviceClient
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
    await printState(serviceClient, game.id, window2.id)
    return
  }

  const { error: refreshError } = await serviceClient.rpc('refresh_pending_window_snapshots', {
    p_window_id: window2.id,
  })
  if (refreshError) {
    console.error('Revalidation failed:', refreshError.message)
    process.exit(1)
  }

  const { data: refreshedWindow, error: refreshLoadError } = await serviceClient
    .from('selection_windows')
    .select('*')
    .eq('id', window2.id)
    .single()
  if (refreshLoadError || !refreshedWindow) {
    console.error('Failed to reload window after revalidation')
    process.exit(1)
  }

  const { data: seasonFixtures, error: seasonError } = await serviceClient
    .from('season_fixtures')
    .select('*')
    .eq('season', game.season)
  if (seasonError) {
    console.error('Failed to load season fixtures:', seasonError.message)
    process.exit(1)
  }

  const { data: snapshotFixtures, error: snapshotError } = await serviceClient
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

  const adminClient = await resolveAdminClient(serviceClient)
  const { data: approved, error: approveError } = await adminClient.rpc('admin_approve_selection_window', {
    p_window_id: window2.id,
  })
  if (approveError) {
    console.error('Approval RPC failed:', approveError.message)
    process.exit(1)
  }

  console.log('Window 2 approved and opened.')
  console.log(JSON.stringify(approved, null, 2))
  await printState(serviceClient, game.id, window2.id)
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
