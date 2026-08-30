import { isDeadlinePassed } from './deadline'

export const LATE_PICK_WARNING =
  'This is a post-deadline admin override. It will be recorded in the audit trail.'

export const LATE_PICK_RESOLVED_MESSAGE =
  'This round has already been resolved. Reopen/correction workflow required.'

export const LATE_PICK_REASON_EXAMPLE =
  'Accepted by organiser: player had no WiFi before deadline.'

export const LATE_PICK_MIN_REASON_LENGTH = 8

export type LatePickWindowMode = 'proxy' | 'late_override' | 'resolved' | 'unavailable'

export function normalizeLatePickReason(reason: string): string {
  return reason.trim()
}

export function isLatePickReasonValid(reason: string): boolean {
  return normalizeLatePickReason(reason).length >= LATE_PICK_MIN_REASON_LENGTH
}

export function getLatePickWindowMode(
  window: { status: string; deadline_at: string } | null,
  nowMs = Date.now(),
): LatePickWindowMode {
  if (!window) return 'unavailable'
  if (window.status === 'resolved' || window.status === 'resolving') return 'resolved'
  if (window.status !== 'open' && window.status !== 'locked') return 'unavailable'
  if (isDeadlinePassed(window.deadline_at, nowMs) || window.status === 'locked') return 'late_override'
  return 'proxy'
}

export function canAdminSubmitLateSelection(input: {
  isAdmin: boolean
  windowStatus: string
  reason: string
}): { allowed: boolean; error: string | null } {
  if (!input.isAdmin) return { allowed: false, error: 'ADMIN_REQUIRED' }
  if (input.windowStatus === 'resolved' || input.windowStatus === 'resolving') {
    return { allowed: false, error: 'ROUND_ALREADY_RESOLVED' }
  }
  if (input.windowStatus !== 'open' && input.windowStatus !== 'locked') {
    return { allowed: false, error: 'NO_ACTIVE_WINDOW' }
  }
  if (!isLatePickReasonValid(input.reason)) {
    return { allowed: false, error: 'LATE_REASON_REQUIRED' }
  }
  return { allowed: true, error: null }
}

export function adminEntryLabel(input: {
  adminCorrected?: boolean | null
  submittedAt?: string | null
  deadlineAt?: string | null
}): string | null {
  if (!input.adminCorrected) return null
  if (input.submittedAt && input.deadlineAt) {
    const submittedMs = Date.parse(input.submittedAt)
    if (Number.isFinite(submittedMs) && isDeadlinePassed(input.deadlineAt, submittedMs)) {
      return 'Late admin entry'
    }
  }
  return 'Admin entered'
}
