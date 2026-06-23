import { getSupabaseOrThrow } from './supabase'
import { isPlayerFacingOpenWindow, MIN_OPERATIONAL_WINDOW_NUMBER } from './windowGuards'
import type { SelectionWindowEligibleFixture, SelectionWindowWithMeta } from '../types'

export function formatLondonDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export async function fetchOpenSelectionWindow(gameId: string): Promise<SelectionWindowWithMeta | null> {
  const client = getSupabaseOrThrow()
  const { data: candidates, error } = await client
    .from('selection_windows')
    .select('*')
    .eq('game_id', gameId)
    .eq('status', 'open')
    .gte('window_number', MIN_OPERATIONAL_WINDOW_NUMBER)
    .order('window_number', { ascending: false })

  if (error) throw error
  if (!candidates?.length) return null

  for (const window of candidates) {
    const { count, error: countError } = await client
      .from('selection_window_eligible_fixtures')
      .select('*', { count: 'exact', head: true })
      .eq('window_id', window.id)

    if (countError) throw countError
    if (isPlayerFacingOpenWindow({ ...window, snapshot_fixture_count: count ?? 0 })) {
      return window
    }
  }

  return null
}

export async function fetchPendingCandidateWindows(gameId: string): Promise<SelectionWindowWithMeta[]> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('selection_windows')
    .select('*')
    .eq('game_id', gameId)
    .eq('status', 'pending')
    .is('review_outcome', null)
    .gte('window_number', 2)
    .order('window_number', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function fetchWindowEligibleFixtures(windowId: string): Promise<SelectionWindowEligibleFixture[]> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('selection_window_eligible_fixtures')
    .select('*')
    .eq('window_id', windowId)
    .order('kickoff_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export type SelectableTeamOption = {
  team_id: string
  team_name: string
  opponent_name: string
  venue: 'Home' | 'Away'
  kickoff_at: string
  kickoff_london: string
}

export function buildSelectableTeamOptions(fixtures: SelectionWindowEligibleFixture[]): SelectableTeamOption[] {
  const byTeam = new Map<string, SelectableTeamOption>()

  for (const fixture of fixtures) {
    const home: SelectableTeamOption = {
      team_id: fixture.home_team_id,
      team_name: fixture.home_team_name,
      opponent_name: fixture.away_team_name,
      venue: 'Home',
      kickoff_at: fixture.kickoff_at,
      kickoff_london: formatLondonDateTime(fixture.kickoff_at),
    }
    const away: SelectableTeamOption = {
      team_id: fixture.away_team_id,
      team_name: fixture.away_team_name,
      opponent_name: fixture.home_team_name,
      venue: 'Away',
      kickoff_at: fixture.kickoff_at,
      kickoff_london: formatLondonDateTime(fixture.kickoff_at),
    }

    const existingHome = byTeam.get(home.team_id)
    if (!existingHome || home.kickoff_at < existingHome.kickoff_at) byTeam.set(home.team_id, home)

    const existingAway = byTeam.get(away.team_id)
    if (!existingAway || away.kickoff_at < existingAway.kickoff_at) byTeam.set(away.team_id, away)
  }

  return [...byTeam.values()].sort((a, b) => a.team_name.localeCompare(b.team_name))
}

export async function fetchFixtureChangeAlerts() {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('fixture_change_events')
    .select('*')
    .eq('resolution_status', 'pending')
    .eq('affects_open_window', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function fetchRecentSyncRuns(limit = 5) {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('fixture_sync_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function fetchFixtureOpsStatus(): Promise<{
  providerConfigured: boolean
  schedulerConfigured: boolean
}> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.functions.invoke('reconcile-fixtures', {
    body: { action: 'status' },
  })
  if (error) throw error
  const payload = data as { providerConfigured?: boolean; schedulerConfigured?: boolean }
  return {
    providerConfigured: Boolean(payload.providerConfigured),
    schedulerConfigured: Boolean(payload.schedulerConfigured),
  }
}

export async function invokeFixtureReconciliation(input?: {
  targetSatDate?: string
  targetSunDate?: string
  sourceType?: 'manual' | 'api_football'
}) {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.functions.invoke('reconcile-fixtures', { body: input ?? {} })
  if (error) throw error
  return data as Record<string, unknown>
}

export async function adminApproveWindow(windowId: string) {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.rpc('admin_approve_selection_window', { p_window_id: windowId })
  if (error) throw error
  return data
}

export async function adminReviewWindow(windowId: string, outcome: 'deferred' | 'rejected') {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.rpc('admin_review_selection_window', {
    p_window_id: windowId,
    p_outcome: outcome,
  })
  if (error) throw error
  return data
}
