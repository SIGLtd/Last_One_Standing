import { TEAM_ID_TO_NAME } from '../config/teams'
import { formatGBP } from './constants'
import { formatCompactDeadlineLondon, formatDeadlineLondon } from './fixtureOps'
import { isCompletedGameStatus, isLiveGameStatus } from './gameLifecycle'
import { operationalWindowToRoundLabel } from './round1'
import { buildRulesSections, rulesHeadlineDeadline } from './rulesContent'
import { getTeamIdentity } from './teamIdentity'
import type { EntryStatus, HistoricalResult, WindowPickRow } from '../types'

export const UI_LAB_DEADLINE_RULE =
  'The normal deadline is 16:00 UK time on the Friday before the Saturday/Sunday fixtures start.'

export const UI_LAB_PREVIEW_ONLY = 'Preview only'

export const BRIGHTON_TEAM_ID = 'bha'

export const REINSTATE_PREVIEW_COPY =
  'Use when a player has been wrongly eliminated and needs to be restored after an organiser-approved correction.'

export const ROUND_EDIT_PREVIEW_COPY =
  'Use when the current open round was created with the wrong deadline or display details.'

export const UI_LAB_SCREENS = [
  'player-home',
  'make-pick',
  'everyones-picks',
  'history',
  'rules',
  'admin-cockpit',
] as const

export type UiLabScreen = (typeof UI_LAB_SCREENS)[number]

export const UI_LAB_SCREEN_LABELS: Record<UiLabScreen, string> = {
  'player-home': 'Player Home Preview',
  'make-pick': 'Make Pick Preview',
  'everyones-picks': "Everyone's Picks Preview",
  history: 'History Preview',
  rules: 'Rules Preview',
  'admin-cockpit': 'Admin Cockpit Preview',
}

export const ADMIN_PREVIEW_SECTIONS = [
  'overview',
  'scores',
  'picks',
  'corrections',
  'lifecycle',
  'comms',
] as const

export type AdminPreviewSection = (typeof ADMIN_PREVIEW_SECTIONS)[number]

export const ADMIN_PREVIEW_SECTION_LABELS: Record<AdminPreviewSection, string> = {
  overview: 'Overview',
  scores: 'Scores',
  picks: 'Picks',
  corrections: 'Corrections',
  lifecycle: 'Game lifecycle',
  comms: 'Comms',
}

export type PreviewPersona = 'live' | 'eliminated' | 'reinstated' | 'complete'

export type PreviewStatusKind =
  | 'guest'
  | 'pending'
  | 'active'
  | 'eliminated'
  | 'reinstated'
  | 'complete'

export type PlayerHomePreviewModel = {
  gameLabel: string
  roundLabel: string
  potLabel: string
  deadlineLabel: string
  deadlineRule: string
  statusLabel: string
  statusKind: PreviewStatusKind
  pickStatus: string
  headline: string
  subtext: string
  ticker: string | null
  nextAction: string
  nextActionTo: string | null
  currentPickTeamId: string | null
  usedTeamIds: string[]
  spectator: boolean
}

export const LIVE_FIXTURE_REVIEW_WARNING =
  'Review required: this round includes a Friday, Monday or midweek fixture.'

export type TeamPickGroup = {
  teamId: string
  teamName: string
  count: number
  playerNames: string[]
}

export type SettlementGateState = {
  unlocked: boolean
  label: string
  reason: string
}

export type AdminOverviewModel = {
  gameLabel: string
  roundLabel: string
  potLabel: string
  survivorCount: number
  picksSubmitted: number
  deadlineLabel: string
  deadlineRule: string
  nextAction: string
  warnings: string[]
}

export function withReinstatedUsedTeams(usedTeamIds: string[]): string[] {
  const next = new Set(usedTeamIds)
  next.add(BRIGHTON_TEAM_ID)
  return [...next]
}

export function resolvePreviewStatus(input: {
  persona: PreviewPersona
  liveEntryStatus: EntryStatus | null | undefined
  gameStatus: string | null | undefined
  isGuest?: boolean
  paid?: boolean | null
}): PreviewStatusKind {
  if (input.persona === 'eliminated') return 'eliminated'
  if (input.persona === 'reinstated') return 'reinstated'
  if (input.persona === 'complete') return 'complete'
  if (isCompletedGameStatus(input.gameStatus)) return 'complete'
  if (input.isGuest) return 'guest'
  if (input.liveEntryStatus === 'eliminated') return 'eliminated'
  if (input.paid === false || input.liveEntryStatus === 'pending_payment') return 'pending'
  return 'active'
}

export function buildPlayerHomePreview(input: {
  persona: PreviewPersona
  gameNumber: number | null
  currentPot: number | null
  roundLabel: string | null
  deadlineAt: string | null
  liveEntryStatus: EntryStatus | null | undefined
  gameStatus: string | null | undefined
  hasCurrentPick: boolean
  currentPickName: string | null
  currentPickTeamId?: string | null
  usedTeamIds: string[]
  survivorCount: number
  isGuest?: boolean
  paid?: boolean | null
  winnerName?: string | null
  prizeAmount?: number | null
  completionKind?: 'winner_paid' | 'rollover' | null
}): PlayerHomePreviewModel {
  const statusKind = resolvePreviewStatus(input)
  const gameLabel = input.gameNumber ? `Game ${input.gameNumber}` : 'Current game'
  const roundLabel = input.roundLabel ?? 'No round yet'
  const potLabel = formatGBP(input.currentPot ?? 0)
  const deadlineLabel = input.deadlineAt ? formatCompactDeadlineLondon(input.deadlineAt) : 'No deadline set'
  const usedTeamIds = statusKind === 'reinstated' ? withReinstatedUsedTeams(input.usedTeamIds) : input.usedTeamIds
  const currentPickTeamId = input.currentPickTeamId ?? null

  if (statusKind === 'complete') {
    const rollover = input.completionKind === 'rollover'
    const amount = formatGBP(input.prizeAmount ?? input.currentPot ?? 0)
    return {
      gameLabel,
      roundLabel,
      potLabel,
      deadlineLabel,
      deadlineRule: UI_LAB_DEADLINE_RULE,
      statusLabel: 'Game complete',
      statusKind,
      pickStatus: rollover ? 'No winner' : `Winner: ${input.winnerName ?? 'Winner'}`,
      headline: 'Game complete',
      subtext: rollover ? `${amount} rolls into the next game` : `Prize paid: ${amount}`,
      ticker: null,
      nextAction: 'View history',
      nextActionTo: '/history',
      currentPickTeamId,
      usedTeamIds,
      spectator: true,
    }
  }

  if (statusKind === 'eliminated') {
    return {
      gameLabel,
      roundLabel,
      potLabel,
      deadlineLabel,
      deadlineRule: UI_LAB_DEADLINE_RULE,
      statusLabel: 'Eliminated',
      statusKind,
      pickStatus: "Let's hope for a rollover",
      headline: 'Eliminated',
      subtext: 'You are out of this game, but you can still follow the picks.',
      ticker: "Let's hope for a rollover",
      nextAction: "View everyone's picks",
      nextActionTo: '/current-picks',
      currentPickTeamId,
      usedTeamIds,
      spectator: true,
    }
  }

  if (statusKind === 'guest') {
    return {
      gameLabel,
      roundLabel,
      potLabel,
      deadlineLabel,
      deadlineRule: UI_LAB_DEADLINE_RULE,
      statusLabel: 'Log in',
      statusKind,
      pickStatus: `${roundLabel} pick required`,
      headline: 'Log in to make your pick.',
      subtext: `Deadline: ${deadlineLabel}`,
      ticker: null,
      nextAction: 'Log in',
      nextActionTo: '/login',
      currentPickTeamId: null,
      usedTeamIds: [],
      spectator: true,
    }
  }

  if (statusKind === 'pending') {
    return {
      gameLabel,
      roundLabel,
      potLabel,
      deadlineLabel,
      deadlineRule: UI_LAB_DEADLINE_RULE,
      statusLabel: 'Entry pending',
      statusKind,
      pickStatus: 'Entry pending',
      headline: 'Entry pending',
      subtext: 'You will be able to pick once your entry is confirmed.',
      ticker: null,
      nextAction: 'Open dashboard',
      nextActionTo: '/dashboard',
      currentPickTeamId: null,
      usedTeamIds,
      spectator: true,
    }
  }

  const reinstated = statusKind === 'reinstated'
  const picked = input.hasCurrentPick

  return {
    gameLabel,
    roundLabel,
    potLabel,
    deadlineLabel,
    deadlineRule: UI_LAB_DEADLINE_RULE,
    statusLabel: reinstated ? 'Still in (reinstated)' : 'Still in',
    statusKind,
    pickStatus: picked ? `You picked ${input.currentPickName ?? 'a team'}` : `${roundLabel} pick required`,
    headline: picked ? 'Pick saved' : `${roundLabel} pick required`,
    subtext: picked
      ? 'You can change this before the deadline'
      : `Deadline: ${deadlineLabel}`,
    ticker: null,
    nextAction: picked ? 'Change pick' : 'Make pick',
    nextActionTo: '/pick',
    currentPickTeamId: picked ? currentPickTeamId : null,
    usedTeamIds,
    spectator: false,
  }
}

export function pickPreviewCanConfirm(input: { spectator: boolean; selectedTeamId: string | null }): boolean {
  return !input.spectator && Boolean(input.selectedTeamId)
}

export function pickPreviewCanSubmit(input: {
  spectator: boolean
  selectedTeamId: string | null
  operational?: boolean
  canPick?: boolean
}): boolean {
  if (!input.operational) return false
  return !input.spectator && Boolean(input.selectedTeamId) && Boolean(input.canPick)
}

export function groupPicksByTeam(rows: WindowPickRow[]): TeamPickGroup[] {
  const groups = new Map<string, TeamPickGroup>()

  for (const row of rows) {
    if (!row.team_id) continue
    const existing = groups.get(row.team_id)
    const playerName = row.display_name
    if (existing) {
      existing.count += 1
      existing.playerNames.push(playerName)
      continue
    }
    groups.set(row.team_id, {
      teamId: row.team_id,
      teamName: TEAM_ID_TO_NAME.get(row.team_id) ?? getTeamIdentity(row.team_id).shortName,
      count: 1,
      playerNames: [playerName],
    })
  }

  return [...groups.values()].sort((a, b) => b.count - a.count || a.teamName.localeCompare(b.teamName))
}

export function historyCardKind(resultType: HistoricalResult['result_type']): 'winner-paid' | 'rollover' | 'in-progress' {
  if (resultType === 'winner') return 'winner-paid'
  if (resultType === 'rollover') return 'rollover'
  return 'in-progress'
}

export function historyCardLabel(kind: ReturnType<typeof historyCardKind>): string {
  if (kind === 'winner-paid') return 'Winner paid'
  if (kind === 'rollover') return 'Rollover'
  return 'In progress'
}

export function formatRepeatWinnersForPreview(value: string): string {
  if (!value || value === '—' || value === '-') return 'None'
  return value
}

export function rulesPreviewSections() {
  return buildRulesSections()
}

export function rulesPreviewDeadlineLine(): string {
  return rulesHeadlineDeadline()
}

export function buildAdminOverview(input: {
  gameNumber: number | null
  currentPot: number | null
  windowNumber: number | null
  deadlineAt: string | null
  windowStatus: string | null
  gameStatus: string | null
  survivorCount: number
  picksSubmitted: number
  paidActiveCount: number
  unpickedCount: number
}): AdminOverviewModel {
  const roundLabel = input.windowNumber ? operationalWindowToRoundLabel(input.windowNumber) : 'No round yet'
  const warnings: string[] = []
  if (input.unpickedCount > 0 && input.windowStatus === 'open') {
    warnings.push(`${input.unpickedCount} active player${input.unpickedCount === 1 ? ' has' : 's have'} not picked yet.`)
  }
  warnings.push('Live deadline is the stored round time. The default rule remains Friday 16:00 UK time.')

  return {
    gameLabel: input.gameNumber ? `Game ${input.gameNumber}` : 'No current game',
    roundLabel,
    potLabel: formatGBP(input.currentPot ?? 0),
    survivorCount: input.survivorCount,
    picksSubmitted: input.picksSubmitted,
    deadlineLabel: input.deadlineAt ? formatDeadlineLondon(input.deadlineAt) : 'No deadline set',
    deadlineRule: UI_LAB_DEADLINE_RULE,
    nextAction: adminNextAction(input),
    warnings,
  }
}

export function adminNextAction(input: {
  gameStatus: string | null
  windowStatus: string | null
  survivorCount: number
  unpickedCount: number
}): string {
  if (isCompletedGameStatus(input.gameStatus)) {
    return 'Game complete. Next step: Start new game'
  }
  if (input.survivorCount === 1) {
    return 'Winner detected. Next step: Complete game'
  }
  if (input.survivorCount === 0 && isLiveGameStatus(input.gameStatus)) {
    return 'No survivors remain. Next step: Complete game as Rollover'
  }
  if (input.windowStatus === 'locked' || input.windowStatus === 'resolving') {
    return 'Next step: Sync latest results'
  }
  if (input.windowStatus === 'resolved') {
    return 'Next step: Open next round'
  }
  if (input.windowStatus === 'open') {
    return 'Next step: Wait for picks'
  }
  return 'Next step: Review the current round'
}

export function settlementGateState(input: {
  gameStatus: string | null
  survivorCount: number
}): SettlementGateState {
  if (isCompletedGameStatus(input.gameStatus)) {
    return {
      unlocked: false,
      label: 'Game complete',
      reason: 'Next step: Start new game',
    }
  }
  if (input.survivorCount === 1) {
    return {
      unlocked: true,
      label: 'Winner detected',
      reason: 'Complete game as Winner paid or Rollover',
    }
  }
  if (input.survivorCount === 0) {
    return {
      unlocked: true,
      label: 'No survivors remain',
      reason: 'Complete game as Rollover',
    }
  }
  return {
    unlocked: false,
    label: 'Settlement locked',
    reason: 'Game completion unlocks when one player remains or when Admin declares a rollover.',
  }
}

export function roundProgressionSteps(input: {
  windowStatus: string | null
  deadlineLabel: string
  survivorCount?: number
  gameStatus?: string | null
}): Array<{ title: string; detail: string; state: 'done' | 'active' | 'waiting' | 'blocked' }> {
  const status = input.windowStatus ?? ''
  const locked = status === 'locked' || status === 'resolving' || status === 'resolved'
  const resolving = status === 'resolving' || status === 'resolved'
  const resolved = status === 'resolved'
  const complete = isCompletedGameStatus(input.gameStatus)
  const settlementReady = (input.survivorCount ?? 99) <= 1

  return [
    {
      title: '1. Submissions open',
      detail: 'Players can change picks until the Friday 16:00 UK deadline.',
      state: status === 'open' ? 'active' : locked || complete ? 'done' : 'waiting',
    },
    {
      title: '2. Deadline lock',
      detail: input.deadlineLabel,
      state: status === 'open' ? 'waiting' : locked && !resolving ? 'active' : locked || complete ? 'done' : 'waiting',
    },
    {
      title: '3. Result sync',
      detail: 'Sync latest results after Saturday and Sunday fixtures finish.',
      state: status === 'resolving' ? 'active' : resolved || complete ? 'done' : locked ? 'waiting' : 'blocked',
    },
    {
      title: '4. Resolve round',
      detail: 'Safe elimination tally after eligible matches complete.',
      state: resolved || complete ? 'done' : status === 'resolving' ? 'active' : 'blocked',
    },
    {
      title: '5. Open next round or complete game',
      detail: settlementReady
        ? 'Complete the game when one player remains or nobody is left.'
        : 'Open the next round while more than one player remains.',
      state: complete ? 'done' : resolved ? 'active' : 'blocked',
    },
  ]
}
