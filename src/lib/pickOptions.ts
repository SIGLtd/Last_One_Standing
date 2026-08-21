import { MIN_OPERATIONAL_WINDOW_NUMBER } from './windowGuards'
import type { SelectableTeamOption } from './fixtureOps'

export type UsedTeamWindow = {
  id: string
  window_number: number
  status: string
  deadline_at: string
}

export function isFinallyUsedWindow(window: UsedTeamWindow, nowMs = Date.now()): boolean {
  if (window.window_number < MIN_OPERATIONAL_WINDOW_NUMBER) return false
  if (window.status === 'locked' || window.status === 'resolving' || window.status === 'resolved') return true
  return new Date(window.deadline_at).getTime() <= nowMs
}

export function finallyUsedWindowIds(windows: UsedTeamWindow[], nowMs = Date.now()): string[] {
  return windows.filter((window) => isFinallyUsedWindow(window, nowMs)).map((window) => window.id)
}

export function usedTeamIdsForPlayer(
  selections: Array<{ player_id: string; window_id: string; team_id: string | null }>,
  playerId: string,
  finalisedWindowIds: string[],
): string[] {
  const finalised = new Set(finalisedWindowIds)
  const used = new Set<string>()

  for (const selection of selections) {
    if (selection.player_id !== playerId) continue
    if (!selection.team_id) continue
    if (!finalised.has(selection.window_id)) continue
    used.add(selection.team_id)
  }

  return [...used]
}

export function filterSelectableTeamOptions(
  options: SelectableTeamOption[],
  usedTeamIds: string[],
): SelectableTeamOption[] {
  if (usedTeamIds.length === 0) return options
  const used = new Set(usedTeamIds)
  return options.filter((option) => !used.has(option.team_id))
}
