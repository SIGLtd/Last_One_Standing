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
  window_number: number
  status: string
  deadline_at: string
  approved_at?: string | null
  snapshot_fixture_count?: number
}

export function isPlayerFacingOpenWindow(
  window: OperationalWindowCandidate,
  nowMs = Date.now(),
): boolean {
  if (!isOperationalWindowNumber(window.window_number)) return false
  if (window.status !== 'open') return false
  if (new Date(window.deadline_at).getTime() <= nowMs) return false
  if ((window.snapshot_fixture_count ?? 0) < 1) return false
  return true
}
