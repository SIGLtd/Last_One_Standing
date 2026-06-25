import { APP_NAME, CURRENT_GAME } from './constants'
import type { GameEntry } from '../types'

export const ROUND1_PUBLIC_LABEL = 'Round 1'

export const ROUND1_WEEKEND_LABEL = 'Saturday 22 and Sunday 23 August'

export const ROUND1_DEADLINE_PLAYER_LABEL = '11:30 BST on Saturday 22 August'

export const ROUND1_EARLIEST_FIXTURE_LABEL = 'Hull City v Manchester United at 12:30 on Saturday 22 August'

export const PUBLIC_ROUND1_OPEN_POINTS = [
  `${ROUND1_PUBLIC_LABEL} is now open.`,
  `It covers fixtures on ${ROUND1_WEEKEND_LABEL}.`,
  `The current pick deadline is ${ROUND1_DEADLINE_PLAYER_LABEL}.`,
  'Eligible fixtures and selections are visible in the app.',
  'Fixtures are based on the official Premier League release.',
  'If a material fixture change occurs, organisers will update the app where required and notify the group through WhatsApp.',
  'Check the app before the deadline.',
] as const

export const PLAYER_ROUND1_OPEN_MESSAGE = `${ROUND1_PUBLIC_LABEL} is open for Game ${CURRENT_GAME}. Make your pick before ${ROUND1_DEADLINE_PLAYER_LABEL}. Fixtures cover ${ROUND1_WEEKEND_LABEL}.`

export const PLAYER_COMPLETE_ENTRY_MESSAGE = `Join Game ${CURRENT_GAME}, pay using the bank details on your dashboard, then wait for payment verification. You can pick once your payment is verified and ${ROUND1_PUBLIC_LABEL} is open.`

export const CURRENT_PICKS_ROUND_OPEN_INTRO = `Every player's pick for ${ROUND1_PUBLIC_LABEL} appears here while the round is live. You do not need to submit your own pick first to view others.`

export const PUBLIC_LOS_APP_URL = 'https://last-one-standing.netlify.app'

export type PlayerEntryState = 'no_entry' | 'awaiting_payment' | 'awaiting_verification' | 'entered_can_pick' | 'entered_waiting'

export function operationalWindowToRoundLabel(windowNumber: number): string {
  if (windowNumber < 2) return `Window ${windowNumber}`
  return `Round ${windowNumber - 1}`
}

export function derivePlayerEntryState(
  entry: GameEntry | null | undefined,
  roundIsOpen: boolean,
): PlayerEntryState {
  if (!entry) return 'no_entry'
  if (entry.paid && entry.status === 'active') return roundIsOpen ? 'entered_can_pick' : 'entered_waiting'
  if (entry.payment_claimed && !entry.paid) return 'awaiting_verification'
  return 'awaiting_payment'
}

export function formatTimeRemaining(deadlineIso: string, nowMs = Date.now()): string {
  const remainingMs = new Date(deadlineIso).getTime() - nowMs
  if (remainingMs <= 0) return 'Deadline passed'

  const totalMinutes = Math.floor(remainingMs / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}d ${hours}h remaining`
  if (hours > 0) return `${hours}h ${minutes}m remaining`
  return `${minutes}m remaining`
}

export function buildWhatsAppRound1OpenNotice(appUrl = PUBLIC_LOS_APP_URL): string {
  return [
    `${APP_NAME} (Game ${CURRENT_GAME}) — ${ROUND1_PUBLIC_LABEL} is now open.`,
    '',
    'Make your pick in the app:',
    appUrl,
    '',
    `Fixtures: ${ROUND1_WEEKEND_LABEL}.`,
    `Deadline: ${ROUND1_DEADLINE_PLAYER_LABEL}.`,
    '',
    'Fixtures follow the official Premier League release. If anything material changes, we will update the app and post on WhatsApp.',
    'Please check the app before the deadline.',
  ].join('\n')
}

export function buildWhatsAppDeadlineReminderNotice(appUrl = PUBLIC_LOS_APP_URL): string {
  return [
    `${APP_NAME} (Game ${CURRENT_GAME}) — ${ROUND1_PUBLIC_LABEL} deadline reminder.`,
    '',
    `Pick deadline: ${ROUND1_DEADLINE_PLAYER_LABEL}.`,
    '',
    'Submit or review your pick in the app:',
    appUrl,
    '',
    'Check the app for the latest fixtures before the deadline.',
  ].join('\n')
}

export const PROVIDER_STATUS_COPY = {
  officialBaseline: 'Official fixture baseline imported and authoritative',
  footballDataConnection: 'football-data.org connection configured',
  footballDataConnectionMissing: 'football-data.org connection not configured',
  scheduleMappingUnavailable: '2026/27 provider schedule mapping not yet available',
  automatedDetectionInactive:
    'Automated material-change detection not currently active until provider fixtures are available and mapped',
} as const
