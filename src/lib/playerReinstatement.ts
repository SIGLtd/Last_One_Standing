import { isDeadlinePassed } from './deadline'
import { outcomeFromFinalFixture } from './latePick'
import { shouldShowEliminatedBanner } from './survivalStatus'

export const REINSTATE_MIN_REASON_LENGTH = 8
export const REINSTATE_STRONG_REASON_LENGTH = 24

export const REINSTATE_SECTION_COPY =
  'Use only when a player has been wrongly eliminated or needs to be restored after an organiser-approved correction. This action is audited.'

export const REINSTATE_NO_WIN_WARNING =
  'No proven winning pick is stored for this round. Reinstating without a winning pick does not mark a team as used. Confirm only if the organiser has approved this.'

export const REINSTATE_RESULT_SYNC_WARNING =
  'This fixture does not have a stored final score. Sync or correct the result before marking the player as survived.'

export const REINSTATE_REASON_EXAMPLE =
  'Correction: player picked Brighton and Brighton won. Player was incorrectly marked eliminated.'

export type ReinstateEntryStatus = 'pending_payment' | 'active' | 'eliminated' | 'winner' | 'withdrawn'

export type ReinstateSelectionState = {
  id: string
  playerId: string
  gameId: string
  windowId: string
  teamId: string | null
  createdAt: string
  outcome: 'survived' | 'eliminated' | 'no_pick' | 'pending' | null
  usedFinal: boolean
  adminCorrected: boolean
  correctionReason: string | null
}

export type ReinstateEntryState = {
  id: string
  playerId: string
  gameId: string
  status: ReinstateEntryStatus
}

export type ProvenWinningPick = {
  teamId: string
  fixtureFinal: boolean
  teamWon: boolean
  needsResultSync: boolean
}

export function isReinstateReasonValid(reason: string, strong = false): boolean {
  const trimmed = reason.trim()
  return trimmed.length >= (strong ? REINSTATE_STRONG_REASON_LENGTH : REINSTATE_MIN_REASON_LENGTH)
}

export function provenWinningPickFromFixture(input: {
  teamId: string | null
  homeTeamId: string
  awayTeamId: string
  homeScore: number | null
  awayScore: number | null
  status: string
  resultStatus: string
}): ProvenWinningPick | null {
  if (!input.teamId) return null
  const result = outcomeFromFinalFixture({
    teamId: input.teamId,
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    status: input.status,
    resultStatus: input.resultStatus,
  })
  return {
    teamId: input.teamId,
    fixtureFinal: result.usedFinal,
    teamWon: result.outcome === 'survived' && result.reason === 'win',
    needsResultSync: !result.usedFinal,
  }
}

export function canAdminReinstatePlayer(input: {
  isAdmin: boolean
  gameStatus: string
  entryStatus: ReinstateEntryStatus | null
  windowExists: boolean
  reason: string
  confirmed: boolean
  provenWin: ProvenWinningPick | null
  confirmWithoutWinningPick: boolean
}): { allowed: boolean; error: string | null; warning: string | null } {
  if (!input.isAdmin) return { allowed: false, error: 'ADMIN_REQUIRED', warning: null }
  if (input.gameStatus === 'complete' || input.gameStatus === 'rolled_over' || input.gameStatus === 'off_season') {
    return { allowed: false, error: 'GAME_COMPLETE', warning: null }
  }
  if (!input.windowExists) return { allowed: false, error: 'NO_ACTIVE_WINDOW', warning: null }
  if (!input.entryStatus) return { allowed: false, error: 'PLAYER_NOT_FOUND', warning: null }
  if (input.entryStatus === 'withdrawn' || input.entryStatus === 'winner') {
    return { allowed: false, error: 'ENTRY_INACTIVE', warning: null }
  }
  if (input.entryStatus === 'pending_payment') return { allowed: false, error: 'ENTRY_INACTIVE', warning: null }
  if (!input.confirmed) return { allowed: false, error: 'CORRECTION_NOT_CONFIRMED', warning: null }

  const hasProvenWin = Boolean(input.provenWin?.teamWon && input.provenWin.fixtureFinal)
  if (input.provenWin?.needsResultSync) {
    return { allowed: false, error: 'RESULT_NOT_FINAL', warning: REINSTATE_RESULT_SYNC_WARNING }
  }
  if (!hasProvenWin && !input.confirmWithoutWinningPick) {
    return { allowed: false, error: 'WINNING_PICK_REQUIRED', warning: REINSTATE_NO_WIN_WARNING }
  }
  if (!isReinstateReasonValid(input.reason, !hasProvenWin)) {
    return { allowed: false, error: 'LATE_REASON_REQUIRED', warning: hasProvenWin ? null : REINSTATE_NO_WIN_WARNING }
  }
  return { allowed: true, error: null, warning: hasProvenWin ? null : REINSTATE_NO_WIN_WARNING }
}

export function applyReinstatementState(input: {
  entry: ReinstateEntryState
  selection: ReinstateSelectionState | null
  teamId: string | null
  reason: string
  actorPlayerId: string
  nowIso: string
  provenWin: ProvenWinningPick | null
}): {
  entry: ReinstateEntryState
  selection: ReinstateSelectionState | null
  duplicatedEntry: boolean
  duplicatedSelection: boolean
  alreadyReinstated: boolean
} {
  const already =
    input.entry.status === 'active' &&
    Boolean(input.selection?.teamId) &&
    input.selection?.outcome === 'survived' &&
    input.selection?.usedFinal === true &&
    (!input.teamId || input.selection.teamId === input.teamId)

  if (already && input.selection) {
    return {
      entry: input.entry,
      selection: input.selection,
      duplicatedEntry: false,
      duplicatedSelection: false,
      alreadyReinstated: true,
    }
  }

  const nextTeam = input.teamId ?? input.selection?.teamId ?? null
  const markSurvived = Boolean(input.provenWin?.teamWon && input.provenWin.fixtureFinal && nextTeam)
  const nextSelection: ReinstateSelectionState | null = input.selection
    ? {
        ...input.selection,
        teamId: nextTeam,
        outcome: markSurvived ? 'survived' : input.selection.outcome,
        usedFinal: markSurvived ? true : input.selection.usedFinal,
        adminCorrected: true,
        correctionReason: input.reason,
        createdAt: input.selection.createdAt,
      }
    : nextTeam
      ? {
          id: `${input.entry.id}-selection`,
          playerId: input.entry.playerId,
          gameId: input.entry.gameId,
          windowId: '',
          teamId: nextTeam,
          createdAt: input.nowIso,
          outcome: markSurvived ? 'survived' : null,
          usedFinal: markSurvived,
          adminCorrected: true,
          correctionReason: input.reason,
        }
      : null

  return {
    entry: { ...input.entry, status: 'active' },
    selection: nextSelection,
    duplicatedEntry: false,
    duplicatedSelection: false,
    alreadyReinstated: false,
  }
}

export function reinstatedPlayerShowsEliminatedBanner(entryStatus: ReinstateEntryStatus): boolean {
  return shouldShowEliminatedBanner(
    entryStatus === 'eliminated' ? 'eliminated' : entryStatus === 'active' ? 'active' : 'other',
  )
}

export function reinstatedTeamIsUsedLater(input: {
  usedTeamIds: string[]
  winningTeamId: string
  nowMs?: number
  laterDeadlineAt?: string
}): boolean {
  if (input.laterDeadlineAt && input.nowMs != null && !isDeadlinePassed(input.laterDeadlineAt, input.nowMs)) {
    return input.usedTeamIds.includes(input.winningTeamId)
  }
  return input.usedTeamIds.includes(input.winningTeamId)
}
