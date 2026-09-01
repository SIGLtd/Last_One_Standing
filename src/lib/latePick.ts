import { isDeadlinePassed } from './deadline'

export const LATE_PICK_WARNING =
  'This is a post-deadline admin override. It will be recorded in the audit trail.'

export const LATE_PICK_RESOLVED_MESSAGE =
  'This round is already resolved. Saving this correction will recalculate this player\'s outcome from the stored final score.'

export const LATE_PICK_REASON_EXAMPLE =
  'Accepted by organiser: player had no WiFi before deadline.'

export const LATE_PICK_ORGANISER_NOTE =
  'Use only when the organiser has accepted a late selection reason.'

export const LATE_PICK_MIN_REASON_LENGTH = 8

export type LatePickWindowMode = 'proxy' | 'late_override' | 'post_result_correction' | 'unavailable'

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
  if (window.status === 'resolved' || window.status === 'resolving') return 'post_result_correction'
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

export function canAdminApplyPostResultCorrection(input: {
  isAdmin: boolean
  windowStatus: string
  reason: string
  confirmed: boolean
  teamEligible: boolean
  teamAlreadyFinallyUsed: boolean
}): { allowed: boolean; error: string | null } {
  if (!input.isAdmin) return { allowed: false, error: 'ADMIN_REQUIRED' }
  if (input.windowStatus !== 'open' && input.windowStatus !== 'locked' && input.windowStatus !== 'resolved') {
    return { allowed: false, error: 'NO_ACTIVE_WINDOW' }
  }
  if (!isLatePickReasonValid(input.reason)) {
    return { allowed: false, error: 'LATE_REASON_REQUIRED' }
  }
  if (!input.confirmed) return { allowed: false, error: 'CORRECTION_NOT_CONFIRMED' }
  if (!input.teamEligible) return { allowed: false, error: 'TEAM_NOT_ELIGIBLE' }
  if (input.teamAlreadyFinallyUsed) return { allowed: false, error: 'TEAM_ALREADY_USED' }
  return { allowed: true, error: null }
}

export function outcomeFromFinalFixture(input: {
  teamId: string
  homeTeamId: string
  awayTeamId: string
  homeScore: number | null
  awayScore: number | null
  status: string
  resultStatus: string
}): { outcome: 'survived' | 'eliminated' | 'pending'; reason: 'win' | 'loss' | 'draw' | 'unresolved'; usedFinal: boolean } {
  const final =
    input.status === 'finished' &&
    input.resultStatus === 'final' &&
    input.homeScore != null &&
    input.awayScore != null
  if (!final) return { outcome: 'pending', reason: 'unresolved', usedFinal: false }
  if (input.homeScore === input.awayScore) return { outcome: 'eliminated', reason: 'draw', usedFinal: true }
  if (input.teamId === input.homeTeamId && (input.homeScore as number) > (input.awayScore as number)) {
    return { outcome: 'survived', reason: 'win', usedFinal: true }
  }
  if (input.teamId === input.awayTeamId && (input.awayScore as number) > (input.homeScore as number)) {
    return { outcome: 'survived', reason: 'win', usedFinal: true }
  }
  return { outcome: 'eliminated', reason: 'loss', usedFinal: true }
}

export function applyPlayerCorrectionState(input: {
  entryStatus: 'active' | 'eliminated' | 'withdrawn'
  outcome: 'survived' | 'eliminated' | 'pending'
}): { entryStatus: 'active' | 'eliminated' | 'withdrawn'; survived: boolean } {
  if (input.entryStatus === 'withdrawn') return { entryStatus: 'withdrawn', survived: false }
  if (input.outcome === 'survived') return { entryStatus: 'active', survived: true }
  if (input.outcome === 'eliminated') return { entryStatus: 'eliminated', survived: false }
  return { entryStatus: input.entryStatus, survived: input.entryStatus === 'active' }
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
