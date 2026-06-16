import { getSupabaseOrThrow } from './supabase'
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
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('selection_windows')
    .select('*')
    .eq('game_id', gameId)
    .order('window_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export async function adminFetchSelectionWindows(gameId: string): Promise<SelectionWindow[]> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('selection_windows')
    .select('*')
    .eq('game_id', gameId)
    .order('window_number', { ascending: false })

  if (error) {
    throw error
  }

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

  if (error) {
    throw error
  }

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

  if (error) {
    throw error
  }

  return data
}

export async function adminLockSelectionWindow(windowId: string): Promise<SelectionWindow> {
  const client = getSupabaseOrThrow()
  const lockedAt = new Date().toISOString()

  const { data: window, error: windowError } = await client
    .from('selection_windows')
    .update({ status: 'locked' })
    .eq('id', windowId)
    .select('*')
    .single()

  if (windowError) {
    throw windowError
  }

  const { error: selectionsError } = await client
    .from('selections')
    .update({ locked_at: lockedAt })
    .eq('window_id', windowId)
    .not('team_id', 'is', null)

  if (selectionsError) {
    throw selectionsError
  }

  return window
}

export async function fetchUsedTeamIds(
  playerId: string,
  gameId: string,
  excludeWindowId?: string,
): Promise<string[]> {
  const client = getSupabaseOrThrow()
  let query = client
    .from('selections')
    .select('team_id, window_id')
    .eq('game_id', gameId)
    .eq('player_id', playerId)
    .not('team_id', 'is', null)

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? [])
    .filter((row) => row.team_id && row.window_id !== excludeWindowId)
    .map((row) => row.team_id as string)
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

  if (error) {
    throw error
  }

  return data
}

export async function saveSelection(input: {
  gameId: string
  windowId: string
  playerId: string
  teamId: string
  window: SelectionWindow
}): Promise<Selection> {
  if (!isWindowEditable(input.window)) {
    throw new Error('Selection window is locked. Picks cannot be changed.')
  }

  const usedTeamIds = await fetchUsedTeamIds(input.playerId, input.gameId, input.windowId)
  if (usedTeamIds.includes(input.teamId)) {
    throw new Error('You have already used this team in Game 27.')
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('selections')
    .upsert(
      {
        game_id: input.gameId,
        window_id: input.windowId,
        player_id: input.playerId,
        team_id: input.teamId,
        locked_at: null,
        admin_corrected: false,
        corrected_by: null,
        correction_reason: null,
      },
      { onConflict: 'window_id,player_id' },
    )
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
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

  if (entriesError) {
    throw entriesError
  }

  if (selectionsError) {
    throw selectionsError
  }

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

export function getPickStatusLabel(
  row: WindowPickRow,
  window: SelectionWindow | null,
): string {
  if (!row.team_id) {
    return 'No pick yet'
  }

  if (row.locked_at || (window && isWindowLocked(window))) {
    return 'Locked'
  }

  return 'Submitted'
}
