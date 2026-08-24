import { isDeadlinePassed } from './deadline'

/** Historic test placeholder — never used for live player operations. */
export const PROTECTED_HISTORIC_WINDOW_NUMBER = 1

/** First real operational LOS window. */
export const MIN_OPERATIONAL_WINDOW_NUMBER = 2

export function isOperationalWindowNumber(windowNumber: number): boolean {
  return windowNumber >= MIN_OPERATIONAL_WINDOW_NUMBER
}

export function isProtectedHistoricWindow(windowNumber: number): boolean {
  return windowNumber === PROTECTED_HISTORIC_WINDOW_NUMBER
}

export type OperationalWindowCandidate = {
  id?: string
  window_number: number
  status: string
  deadline_at: string
  approved_at?: string | null
  snapshot_fixture_count?: number
}

const VIEWABLE_CURRENT_PICKS_STATUSES = new Set(['open', 'locked', 'resolving', 'resolved'])

export function isPlayerFacingOpenWindow(
  window: OperationalWindowCandidate,
  nowMs = Date.now(),
): boolean {
  if (!isOperationalWindowNumber(window.window_number)) return false
  if (window.status !== 'open') return false
  if (isDeadlinePassed(window.deadline_at, nowMs)) return false
  if ((window.snapshot_fixture_count ?? 0) < 1) return false
  return true
}

/** Deadline-sensitive: used only for save/amend, not for viewing picks. */
export function canSubmitPick(window: OperationalWindowCandidate, nowMs = Date.now()): boolean {
  return isPlayerFacingOpenWindow(window, nowMs)
}

/** Current operational round remains viewable after the deadline and after lock. */
export function canViewCurrentPicks(
  window: { window_number: number; status: string } | null | undefined,
): boolean {
  if (!window) return false
  if (!isOperationalWindowNumber(window.window_number)) return false
  return VIEWABLE_CURRENT_PICKS_STATUSES.has(window.status)
}

/** Latest operational window with fixtures. Current Picks follows this, including after resolve until the next round opens. */
export function selectLatestOperationalWindow<T extends OperationalWindowCandidate>(windows: T[]): T | null {
  return (
    windows
      .filter((window) => isOperationalWindowNumber(window.window_number))
      .filter((window) => VIEWABLE_CURRENT_PICKS_STATUSES.has(window.status))
      .filter((window) => (window.snapshot_fixture_count ?? 1) > 0)
      .sort((a, b) => b.window_number - a.window_number)[0] ?? null
  )
}
