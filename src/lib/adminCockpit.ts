import type { GameEntryWithPlayer, Player, SeasonFixture, SelectionWindowEligibleFixture, SelectionWindowWithMeta } from '../types'
import { ROUND1_PUBLIC_LABEL, formatTimeRemaining, operationalWindowToRoundLabel } from './round1'
import { buildPlayerCensus, type PlayerCensus } from './playerCensus'
import { inspectWeekendSnapshot } from './weekendSnapshot'
import { INVALID_WEEKDAY_SNAPSHOT_WARNING } from './weekendFixtures'

export const ADMIN_COCKPIT_SECTION_ORDER = [
  'round_control',
  'this_round',
  'players_payments',
  'communications',
  'advanced_operations',
] as const

export type AdminCockpitSectionId = (typeof ADMIN_COCKPIT_SECTION_ORDER)[number]

export type RoundControlStats = {
  roundLabel: string
  statusLabel: string
  deadlineLabel: string
  timeRemaining: string
  eligibleFixtureCount: number
  saturdayCount: number
  sundayCount: number
  weekendLabel: string | null
  snapshotValid: boolean
  snapshotIssues: string[]
  selectionsMade: number
  paidActivePlayers: number
  awaitingVerification: number
  lastRevalidationAt: string | null
}

export function buildRoundControlStats(input: {
  openWindow: SelectionWindowWithMeta
  snapshotFixtures: SelectionWindowEligibleFixture[]
  seasonFixtures?: SeasonFixture[]
  entries: GameEntryWithPlayer[]
  selectionsMade: number
  nowMs?: number
}): RoundControlStats {
  const paidActivePlayers = input.entries.filter((entry) => entry.paid && entry.status === 'active').length
  const awaitingVerification = input.entries.filter((entry) => entry.payment_claimed && !entry.paid).length
  const seasonById = new Map((input.seasonFixtures ?? []).map((row) => [row.id, row]))
  const validity = inspectWeekendSnapshot(
    input.snapshotFixtures.map((fixture) => {
      const live = seasonById.get(fixture.season_fixture_id)
      return {
        season_fixture_id: fixture.season_fixture_id,
        home_team_id: fixture.home_team_id,
        away_team_id: fixture.away_team_id,
        kickoff_at: live?.kickoff_at || fixture.kickoff_at,
        eligibility_override: live?.eligibility_override ?? 'none',
        canonical_key: live?.canonical_key,
      }
    }),
  )
  const weekendLabel =
    input.openWindow.eligible_sat_date && input.openWindow.eligible_sun_date
      ? `${input.openWindow.eligible_sat_date} to ${input.openWindow.eligible_sun_date}`
      : validity.weekendLabel

  const snapshotIssues =
    validity.nonWeekend.length > 0 && !validity.issues.includes(INVALID_WEEKDAY_SNAPSHOT_WARNING)
      ? [INVALID_WEEKDAY_SNAPSHOT_WARNING, ...validity.issues]
      : validity.issues

  return {
    roundLabel: operationalWindowToRoundLabel(input.openWindow.window_number) || ROUND1_PUBLIC_LABEL,
    statusLabel:
      input.openWindow.status === 'resolved'
        ? 'Resolved'
        : input.openWindow.status === 'locked'
          ? 'Locked'
          : input.openWindow.status === 'resolving'
            ? 'Resolving'
            : 'Open',
    deadlineLabel: input.openWindow.deadline_at,
    timeRemaining: formatTimeRemaining(input.openWindow.deadline_at, input.nowMs),
    eligibleFixtureCount: input.snapshotFixtures.length,
    saturdayCount: validity.saturdayCount,
    sundayCount: validity.sundayCount,
    weekendLabel,
    snapshotValid: validity.valid,
    snapshotIssues,
    selectionsMade: input.selectionsMade,
    paidActivePlayers,
    awaitingVerification,
    lastRevalidationAt: input.openWindow.approved_at ?? input.openWindow.updated_at,
  }
}

export function buildPlayerPaymentSummary(
  entries: GameEntryWithPlayer[],
  playersOrRegisteredCount: Player[] | number,
): PlayerCensus & {
  registered: number
  activePaid: number
  awaitingVerification: number
  notActive: number
} {
  const players = Array.isArray(playersOrRegisteredCount) ? playersOrRegisteredCount : []
  const census = players.length
    ? buildPlayerCensus(players, entries)
    : {
        registered: typeof playersOrRegisteredCount === 'number' ? playersOrRegisteredCount : 0,
        activeEntrants: entries.filter((entry) => entry.status === 'active').length,
        paidVerified: entries.filter((entry) => entry.paid && entry.status === 'active').length,
        awaitingPayment: entries.filter((entry) => !entry.paid && !entry.payment_claimed).length,
        awaitingVerification: entries.filter((entry) => entry.payment_claimed && !entry.paid).length,
        inactive: entries.filter((entry) => entry.status !== 'active').length,
        adminBuildOnly: 0,
        manualOffline: 0,
      }

  return {
    ...census,
    registered: census.registered,
    activePaid: census.paidVerified,
    awaitingVerification: census.awaitingVerification,
    notActive: census.registered - census.activeEntrants,
  }
}
