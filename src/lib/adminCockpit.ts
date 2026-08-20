import type { GameEntryWithPlayer, Player, SelectionWindowEligibleFixture, SelectionWindowWithMeta } from '../types'
import { ROUND1_PUBLIC_LABEL, formatTimeRemaining, operationalWindowToRoundLabel } from './round1'
import { buildPlayerCensus, type PlayerCensus } from './playerCensus'

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
  selectionsMade: number
  paidActivePlayers: number
  awaitingVerification: number
  lastRevalidationAt: string | null
}

export function buildRoundControlStats(input: {
  openWindow: SelectionWindowWithMeta
  snapshotFixtures: SelectionWindowEligibleFixture[]
  entries: GameEntryWithPlayer[]
  selectionsMade: number
  nowMs?: number
}): RoundControlStats {
  const paidActivePlayers = input.entries.filter((entry) => entry.paid && entry.status === 'active').length
  const awaitingVerification = input.entries.filter((entry) => entry.payment_claimed && !entry.paid).length

  return {
    roundLabel: operationalWindowToRoundLabel(input.openWindow.window_number) || ROUND1_PUBLIC_LABEL,
    statusLabel: 'Open',
    deadlineLabel: input.openWindow.deadline_at,
    timeRemaining: formatTimeRemaining(input.openWindow.deadline_at, input.nowMs),
    eligibleFixtureCount: input.snapshotFixtures.length,
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
