import { getFinallyUsedTeamsForPlayer } from './pickOptions'
import { fetchCurrentOperationalWindow } from './fixtureOps'
import { isDeadlinePassed } from './deadline'
import { getSupabaseOrThrow } from './supabase'
import { parsePickError, pickErrorLabel } from './pickErrors'
import type { Selection, SelectionWindow, SelectionWindowStatus, WindowPickRow } from '../types'

export type SelectionWindowPayload = {
  window_number: number
  start_at: string
  end_at: string
  deadline_at: string
  status: SelectionWindowStatus
}

export function isWindowLocked(window: SelectionWindow, nowMs = Date.now()): boolean {
  if (window.status === 'locked' || window.status === 'resolving' || window.status === 'resolved') {
    return true
  }
  return isDeadlinePassed(window.deadline_at, nowMs)
}

export function isWindowEditable(window: SelectionWindow, nowMs = Date.now()): boolean {
  return window.status === 'open' && !isWindowLocked(window, nowMs)
}

export function canSubmitPick(window: SelectionWindow, nowMs = Date.now()): boolean {
  return isWindowEditable(window, nowMs)
}

export async function fetchCurrentSelectionWindow(gameId: string): Promise<SelectionWindow | null> {
  return fetchCurrentOperationalWindow(gameId)
}

export async function getCurrentOperationalWindow(gameId: string): Promise<SelectionWindow | null> {
  return fetchCurrentOperationalWindow(gameId)
}

export async function adminFetchSelectionWindows(gameId: string): Promise<SelectionWindow[]> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('selection_windows')
    .select('*')
    .eq('game_id', gameId)
    .order('window_number', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function adminCreateSelectionWindow(
  gameId: string,
  payload: SelectionWindowPayload,
): Promise<SelectionWindow> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('selection_windows')
    .insert({
      game_id: gameId,
      window_number: payload.window_number,
      start_at: payload.start_at,
      end_at: payload.end_at,
      deadline_at: payload.deadline_at,
      status: payload.status,
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function adminUpdateSelectionWindow(
  windowId: string,
  payload: Partial<SelectionWindowPayload>,
): Promise<SelectionWindow> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('selection_windows')
    .update(payload)
    .eq('id', windowId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function adminLockSelectionWindow(windowId: string): Promise<SelectionWindow> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.rpc('admin_lock_selection_window', { p_window_id: windowId })
  if (error) throw error
  return data as SelectionWindow
}

export async function adminCountSelectionsForWindow(windowId: string): Promise<number> {
  const client = getSupabaseOrThrow()
  const { count, error } = await client
    .from('selections')
    .select('*', { count: 'exact', head: true })
    .eq('window_id', windowId)

  if (error) throw error
  return count ?? 0
}

export async function fetchFinallyUsedTeamIds(playerId: string, gameId: string): Promise<string[]> {
  return getFinallyUsedTeamsForPlayerFromDb(playerId, gameId)
}

export async function getFinallyUsedTeamsForPlayerFromDb(playerId: string, gameId: string): Promise<string[]> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('selections')
    .select('team_id, used_final, window_id, window:selection_windows!inner(status, window_number)')
    .eq('game_id', gameId)
    .eq('player_id', playerId)
    .not('team_id', 'is', null)

  if (error) throw error

  return getFinallyUsedTeamsForPlayer(
    (data ?? []).map((row) => ({
      player_id: playerId,
      window_id: row.window_id as string,
      team_id: row.team_id as string | null,
      used_final: Boolean((row as { used_final?: boolean }).used_final),
    })),
    playerId,
    (data ?? []).map((row) => {
      const window = Array.isArray(row.window) ? row.window[0] : row.window
      return {
        id: row.window_id as string,
        window_number: window?.window_number ?? 0,
        status: window?.status ?? 'open',
        deadline_at: '1970-01-01T00:00:00.000Z',
      }
    }),
  )
}

export async function fetchMySelection(
  playerId: string,
  gameId: string,
  windowId: string,
): Promise<Selection | null> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('selections')
    .select('*')
    .eq('game_id', gameId)
    .eq('player_id', playerId)
    .eq('window_id', windowId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function saveSelection(input: {
  windowId: string
  teamId: string
}): Promise<Selection> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.rpc('submit_selection', {
    p_window_id: input.windowId,
    p_team_id: input.teamId,
  })

  if (error) {
    const code = parsePickError(error.message)
    throw new Error(pickErrorLabel(code))
  }

  return data as Selection
}

export async function adminSubmitSelection(input: {
  playerId: string
  windowId: string
  teamId: string
}): Promise<Selection> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.rpc('admin_submit_selection', {
    p_player_id: input.playerId,
    p_window_id: input.windowId,
    p_team_id: input.teamId,
  })

  if (error) {
    if (error.message.includes('ADMIN_REQUIRED')) {
      throw new Error('Admin access is required to enter a pick for someone else.')
    }
    const code = parsePickError(error.message)
    throw new Error(pickErrorLabel(code))
  }

  return data as Selection
}

export async function adminSubmitLateSelection(input: {
  playerId: string
  windowId: string
  teamId: string
  reason: string
}): Promise<Selection> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.rpc('admin_submit_late_selection', {
    p_player_id: input.playerId,
    p_window_id: input.windowId,
    p_team_id: input.teamId,
    p_reason: input.reason,
  })

  if (error) {
    if (error.message.includes('ADMIN_REQUIRED')) {
      throw new Error('Admin access is required to enter a late pick.')
    }
    const code = parsePickError(error.message)
    throw new Error(pickErrorLabel(code))
  }

  return data as Selection
}

export async function adminFetchWindowSelections(windowId: string): Promise<Selection[]> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('selections')
    .select('*')
    .eq('window_id', windowId)
    .not('team_id', 'is', null)
    .order('updated_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function adminFetchAllWindowSelections(windowId: string): Promise<Selection[]> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('selections')
    .select('*')
    .eq('window_id', windowId)
    .order('updated_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function fetchSubmittedTeamIdsForWindow(windowId: string): Promise<string[]> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('selections')
    .select('team_id')
    .eq('window_id', windowId)
    .not('team_id', 'is', null)

  if (error) throw error
  return (data ?? []).map((row) => row.team_id as string)
}

export async function fetchCurrentWindowPicks(gameId: string, windowId: string): Promise<WindowPickRow[]> {
  const client = getSupabaseOrThrow()

  const { data: publicRows, error: publicError } = await client.rpc('public_current_window_picks', {
    p_window_id: windowId,
  })

  if (!publicError && Array.isArray(publicRows) && publicRows.length > 0) {
    return publicRows.map((row) => ({
      player_id: row.player_id,
      display_name: row.display_name,
      team_id: row.team_id,
      locked_at: row.locked_at ?? null,
      entry_status: 'active',
      updated_at: row.updated_at ?? null,
        admin_corrected: Boolean(row.admin_corrected),
        outcome: (row.outcome ?? null) as WindowPickRow['outcome'],
        used_final: Boolean(row.used_final),
      }))
    }

  const [{ data: entries, error: entriesError }, { data: selections, error: selectionsError }] = await Promise.all([
    client
      .from('game_entries')
      .select('player_id, status, paid, player:players(display_name)')
      .eq('game_id', gameId)
      .eq('status', 'active'),
    client.from('selections').select('*').eq('game_id', gameId).eq('window_id', windowId),
  ])

  if (selectionsError) throw selectionsError
  if (entriesError && !(selections ?? []).length) throw entriesError

  const selectionByPlayer = new Map((selections ?? []).map((selection) => [selection.player_id, selection]))

  if ((entries ?? []).length > 0) {
    return (entries ?? []).map((entry) => {
      const selection = selectionByPlayer.get(entry.player_id)
      const rawPlayer = entry.player as { display_name: string } | { display_name: string }[] | null
      const player = Array.isArray(rawPlayer) ? rawPlayer[0] ?? null : rawPlayer

      return {
        player_id: entry.player_id,
        display_name: player?.display_name ?? 'Unknown player',
        team_id: selection?.team_id ?? null,
        locked_at: selection?.locked_at ?? null,
        entry_status: entry.status,
        paid: Boolean((entry as { paid?: boolean }).paid),
        updated_at: selection?.updated_at ?? selection?.created_at ?? null,
        admin_corrected: Boolean(selection?.admin_corrected),
        outcome: selection?.outcome ?? null,
        used_final: Boolean(selection?.used_final),
      }
    })
  }

  return (selections ?? [])
    .filter((selection) => Boolean(selection.team_id))
    .map((selection) => ({
      player_id: selection.player_id,
      display_name: 'Unknown player',
      team_id: selection.team_id ?? null,
      locked_at: selection.locked_at ?? null,
      entry_status: 'active' as const,
      updated_at: selection.updated_at ?? selection.created_at ?? null,
      admin_corrected: Boolean(selection.admin_corrected),
      outcome: selection.outcome ?? null,
      used_final: Boolean(selection.used_final),
    }))
}

export function getPickStatusLabel(row: WindowPickRow, window: SelectionWindow | null): string {
  if (row.outcome === 'survived') return 'Survived'
  if (row.outcome === 'eliminated') return 'Eliminated'
  if (row.outcome === 'no_pick') return 'No pick'
  if (!row.team_id) return 'No pick yet'
  if (row.locked_at || (window && isWindowLocked(window))) return 'Locked'
  return 'Submitted'
}

export function getPickSurvivalLabel(row: WindowPickRow): string {
  if (row.outcome === 'survived') return 'Survived'
  if (row.outcome === 'eliminated' || row.outcome === 'no_pick') return 'Eliminated 💀'
  if (row.entry_status === 'eliminated') return 'Eliminated 💀'
  return 'Still in'
}

export async function adminApplyRoundResolution(windowId: string) {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.rpc('admin_apply_round_resolution', { p_window_id: windowId })
  if (error) throw error
  return data as Record<string, unknown>
}

export async function adminOpenNextRound(input: {
  currentWindowId: string
  sat: string
  sun: string
  deadlineAt: string
}) {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.rpc('admin_open_next_round', {
    p_current_window_id: input.currentWindowId,
    p_sat: input.sat,
    p_sun: input.sun,
    p_deadline: input.deadlineAt,
  })
  if (error) throw error
  return data as Record<string, unknown>
}

export async function adminRebuildOpenWeekendSnapshot(windowId: string) {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.rpc('admin_rebuild_open_weekend_snapshot', { p_window_id: windowId })
  if (error) throw error
  return data as Record<string, unknown>
}

export { parsePickError, pickErrorLabel, getFinallyUsedTeamsForPlayer }
