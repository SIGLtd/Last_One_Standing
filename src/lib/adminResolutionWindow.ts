import { isDeadlinePassed } from './deadline'
import { isOperationalWindowNumber } from './windowGuards'

const RESOLUTION_STATUSES = new Set(['open', 'locked', 'resolving', 'resolved'])
const LIVE_ROUND_STATUSES = new Set(['open', 'locked', 'resolving'])

export type AdminWindowCandidate = {
  id: string
  window_number: number
  status: string
  deadline_at: string
}

export function getAdminLiveOpenWindow<T extends AdminWindowCandidate>(windows: T[]): T | null {
  return (
    windows
      .filter((window) => isOperationalWindowNumber(window.window_number))
      .filter((window) => LIVE_ROUND_STATUSES.has(window.status))
      .sort((a, b) => b.window_number - a.window_number)[0] ?? null
  )
}

function isDueForResolution<T extends AdminWindowCandidate>(window: T, nowMs: number): boolean {
  if (window.status === 'locked' || window.status === 'resolving') return true
  if (window.status !== 'open') return false
  return isDeadlinePassed(window.deadline_at, nowMs)
}

/**
 * Window used for Admin resolve/audit.
 * Prefers the earliest unresolved operational round that is actually due.
 * If a future next round is already open (deadline not yet passed), audit the just-resolved round.
 * Never selects protected Window 1.
 */
export function getAdminResolutionWindow<T extends AdminWindowCandidate>(
  windows: T[],
  nowMs = Date.now(),
): T | null {
  const operational = windows
    .filter((window) => isOperationalWindowNumber(window.window_number))
    .filter((window) => RESOLUTION_STATUSES.has(window.status))
    .sort((a, b) => a.window_number - b.window_number)

  if (operational.length === 0) return null

  const unresolved = operational.filter((window) => window.status !== 'resolved')
  const resolved = operational.filter((window) => window.status === 'resolved')
  const dueUnresolved = unresolved.filter((window) => isDueForResolution(window, nowMs))
  if (dueUnresolved.length > 0) return dueUnresolved[0]

  const latestResolved = resolved[resolved.length - 1] ?? null
  const futureNext = unresolved.find(
    (window) => latestResolved && window.window_number > latestResolved.window_number && !isDeadlinePassed(window.deadline_at, nowMs),
  )
  if (latestResolved && futureNext) return latestResolved

  if (unresolved.length > 0) return unresolved[0]
  return latestResolved
}

export function countSubmittedPicksByWindowId(
  selections: Array<{ window_id?: string | null; team_id?: string | null }>,
  windowId: string,
): number {
  return selections.filter((selection) => {
    if (selection.window_id && selection.window_id !== windowId) return false
    return Boolean(selection.team_id)
  }).length
}
