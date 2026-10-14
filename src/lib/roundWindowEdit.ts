import { isDeadlinePassed, parseDeadlineUtcMs } from './deadline'

export const ROUND_EDIT_MIN_REASON_LENGTH = 8

export const ROUND_EDIT_COPY =
  'Change the open round deadline without altering picks or the fixture list. This action is audited.'

export const ROUND_EDIT_REASON_EXAMPLE = 'Correction: round was opened with the wrong deadline.'

export const ROUND_EDIT_PICKS_WARNING =
  'Picks already exist for this round. The deadline can be corrected, but existing picks stay as they are.'

export const ROUND_EDIT_KICKOFF_WARNING =
  'The new deadline is at or after the first eligible kick-off. Choose an earlier time unless this is an announced exception.'

export function isRoundEditReasonValid(reason: string): boolean {
  return reason.trim().length >= ROUND_EDIT_MIN_REASON_LENGTH
}

export function canAdminUpdateRoundWindow(input: {
  isAdmin: boolean
  gameStatus: string
  windowStatus: string
  newDeadlineAt: string
  currentDeadlineAt: string
  earliestKickoffAt: string | null
  pickCount: number
  reason: string
  confirmed: boolean
  nowMs?: number
}): { allowed: boolean; error: string | null; warning: string | null } {
  const nowMs = input.nowMs ?? Date.now()
  if (!input.isAdmin) return { allowed: false, error: 'ADMIN_REQUIRED', warning: null }
  if (input.gameStatus === 'complete' || input.gameStatus === 'rolled_over' || input.gameStatus === 'off_season') {
    return { allowed: false, error: 'GAME_COMPLETE', warning: null }
  }
  if (input.windowStatus === 'resolved' || input.windowStatus === 'resolving' || input.windowStatus === 'complete') {
    return { allowed: false, error: 'ROUND_ALREADY_RESOLVED', warning: null }
  }
  if (input.windowStatus !== 'open' && input.windowStatus !== 'locked') {
    return { allowed: false, error: 'ROUND_NOT_EDITABLE', warning: null }
  }

  const newMs = parseDeadlineUtcMs(input.newDeadlineAt)
  if (!Number.isFinite(newMs)) return { allowed: false, error: 'INVALID_DEADLINE', warning: null }

  const kickoffMs = input.earliestKickoffAt ? parseDeadlineUtcMs(input.earliestKickoffAt) : Number.NaN
  if (Number.isFinite(kickoffMs) && newMs >= kickoffMs) {
    return { allowed: false, error: 'DEADLINE_AFTER_KICKOFF', warning: ROUND_EDIT_KICKOFF_WARNING }
  }

  const picksExist = input.pickCount > 0
  const deadlinePassed = isDeadlinePassed(input.currentDeadlineAt, nowMs)
  if (!input.confirmed) return { allowed: false, error: 'CORRECTION_NOT_CONFIRMED', warning: picksExist ? ROUND_EDIT_PICKS_WARNING : null }
  if ((picksExist || deadlinePassed) && !isRoundEditReasonValid(input.reason)) {
    return { allowed: false, error: 'LATE_REASON_REQUIRED', warning: picksExist ? ROUND_EDIT_PICKS_WARNING : null }
  }
  if (!isRoundEditReasonValid(input.reason)) {
    return { allowed: false, error: 'LATE_REASON_REQUIRED', warning: null }
  }

  return {
    allowed: true,
    error: null,
    warning: picksExist ? ROUND_EDIT_PICKS_WARNING : Number.isFinite(kickoffMs) && newMs >= kickoffMs ? ROUND_EDIT_KICKOFF_WARNING : null,
  }
}

export function preservePicksAfterDeadlineEdit<T>(picks: T[]): T[] {
  return [...picks]
}
