import { fetchOpenSelectionWindow } from './fixtureOps'
import { getSupabaseOrThrow } from './supabase'
import { MIN_OPERATIONAL_WINDOW_NUMBER } from './windowGuards'
import { parsePickError, pickErrorLabel } from './pickErrors'
import type { Selection, SelectionWindow, SelectionWindowStatus, WindowPickRow } from '../types'

export type SelectionWindowPayload = {
  window_number: number
  start_at: string
  end_at: string
  deadline_at: string
  status: SelectionWindowStatus
}

export function isWindowLocked(window: SelectionWindow): boolean {
  if (window.status === 'locked' || window.status === 'resolving' || window.status === 'resolved') {
    return true
  }
  return Date.now() >= new Date(window.deadline_at).getTime()
}

export function isWindowEditable(window: SelectionWindow): boolean {
  return window.status === 'open' && !isWindowLocked(window)
}

export async function fetchCurrentSelectionWindow(gameId: string): Promise<SelectionWindow | null> {
  return fetchOpenSelectionWindow(gameId)
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

export async function fetchFinallyUsedTeamIds(playerId: string, gameId: string): Promise<string[]> {
  const client = getSupabaseOrThrow()
  const { data: windows, error: windowError } = await client
    .from('selection_windows')
    .select('id, status, deadline_at, window_number')
    .eq('game_id', gameId)

  if (windowError) throw windowError

  const now = Date.now()
  const finalisedWindowIds = (windows ?? [])
    .filter(
      (w) =>
        w.window_number >= MIN_OPERATIONAL_WINDOW_NUMBER &&
        (w.status === 'locked' ||
          w.status === 'resolved' ||
          new Date(w.deadline_at).getTime() <= now),
    )
    .map((w) => w.id)

  if (finalisedWindowIds.length === 0) return []

  const { data, error } = await client
    .from('selections')
    .select('team_id')
    .eq('game_id', gameId)
    .eq('player_id', playerId)
    .not('team_id', 'is', null)
    .in('window_id', finalisedWindowIds)

  if (error) throw error
  return [...new Set((data ?? []).map((row) => row.team_id as string))]
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

export async function fetchCurrentWindowPicks(gameId: string, windowId: string): Promise<WindowPickRow[]> {
  const client = getSupabaseOrThrow()

  const [{ data: entries, error: entriesError }, { data: selections, error: selectionsError }] = await Promise.all([
    client
      .from('game_entries')
      .select('player_id, status, player:players(display_name)')
      .eq('game_id', gameId)
      .eq('status', 'active'),
    client.from('selections').select('*').eq('game_id', gameId).eq('window_id', windowId),
  ])

  if (entriesError) throw entriesError
  if (selectionsError) throw selectionsError

  const selectionByPlayer = new Map((selections ?? []).map((selection) => [selection.player_id, selection]))

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
    }
  })
}

export function getPickStatusLabel(row: WindowPickRow, window: SelectionWindow | null): string {
  if (!row.team_id) return 'No pick yet'
  if (row.locked_at || (window && isWindowLocked(window))) return 'Locked'
  return 'Submitted'
}

export { parsePickError, pickErrorLabel }
