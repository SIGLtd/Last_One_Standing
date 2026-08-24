import { MIN_OPERATIONAL_WINDOW_NUMBER } from './windowGuards'
import type { SelectableTeamOption } from './fixtureOps'

export type UsedTeamWindow = {
  id: string
  window_number: number
  status: string
  deadline_at: string
}

export type UsedTeamSelection = {
  player_id: string
  window_id: string
  team_id: string | null
  used_final?: boolean
}

export function isFinallyUsedWindow(window: UsedTeamWindow, _nowMs = Date.now()): boolean {
  if (window.window_number < MIN_OPERATIONAL_WINDOW_NUMBER) return false
  return window.status === 'resolved'
}

export function finallyUsedWindowIds(windows: UsedTeamWindow[], nowMs = Date.now()): string[] {
  return windows.filter((window) => isFinallyUsedWindow(window, nowMs)).map((window) => window.id)
}

export function usedTeamIdsForPlayer(
  selections: UsedTeamSelection[],
  playerId: string,
  finalisedWindowIds: string[],
): string[] {
  const finalised = new Set(finalisedWindowIds)
  const used = new Set<string>()

  for (const selection of selections) {
    if (selection.player_id !== playerId) continue
    if (!selection.team_id) continue
    if (selection.used_final === true || finalised.has(selection.window_id)) {
      used.add(selection.team_id)
    }
  }

  return [...used]
}

export function getFinallyUsedTeamsForPlayer(
  selections: UsedTeamSelection[],
  playerId: string,
  windows: UsedTeamWindow[],
  nowMs = Date.now(),
): string[] {
  return usedTeamIdsForPlayer(selections, playerId, finallyUsedWindowIds(windows, nowMs))
}

export function filterSelectableTeamOptions(
  options: SelectableTeamOption[],
  usedTeamIds: string[],
): SelectableTeamOption[] {
  if (usedTeamIds.length === 0) return options
  const used = new Set(usedTeamIds)
  return options.filter((option) => !used.has(option.team_id))
}
