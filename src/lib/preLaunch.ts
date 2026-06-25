import { APP_NAME, CURRENT_GAME } from './constants'
import type { Game, GameEntry, GameEntryWithPlayer, SelectionWindowWithMeta } from '../types'
import { WINDOW2_NUMBER, WINDOW2_PLANNED_WEEKEND_LABEL, isDraftOperationalWindow, shouldShowPlayerPickForm } from './window2Draft'

export const PUBLIC_LOS_APP_URL = 'https://last-one-standing.netlify.app'

export const PRE_LAUNCH_WEEKEND_LABEL = '22 to 23 August 2026'

export const PUBLIC_APP_INTRO = `${APP_NAME} is now the official home for Game ${CURRENT_GAME}: register, pay, make weekly selections once a round is open, and view competition history and rules.`

export const PUBLIC_PRE_LAUNCH_POINTS = [
  `First planned live weekend: ${PRE_LAUNCH_WEEKEND_LABEL}.`,
  'Team picks are not open yet.',
  'Paid, verified players will be able to select once the organiser approves and opens the round.',
  'The exact pick deadline will be confirmed when the round opens.',
] as const

export const PLAYER_PICKS_NOT_OPEN_MESSAGE = `Window 2 is planned for ${PRE_LAUNCH_WEEKEND_LABEL}. Picks are not open yet — return here after the organiser opens the round.`

export const PLAYER_ENTERED_WAITING_MESSAGE = `You are entered into Game ${CURRENT_GAME}. Window 2 is planned for ${PRE_LAUNCH_WEEKEND_LABEL}. Selections are not open yet — you will make your visible pick here once the organiser opens the round.`

export const PLAYER_COMPLETE_ENTRY_MESSAGE = `Join Game ${CURRENT_GAME}, pay using the bank details on your dashboard, then wait for payment verification. Picks open after the organiser approves the first live round.`

export const CURRENT_PICKS_PRE_LAUNCH_MESSAGE = `No live selection round is open yet. When Window 2 is published, every player's pick for that round will appear here automatically — you do not need to submit your own pick first to view others.`

export const ORGANISER_NEXT_ACTION =
  'Revalidate the Window 2 draft snapshot against season_fixtures, then approve and publish nearer the fixture weekend.'

export type LaunchReadinessStats = {
  registeredPlayerCount: number
  activePaidEntryCount: number
  awaitingVerificationCount: number
  notYetActiveEntryCount: number
  currentPot: number
  window2Status: string
  window2Live: boolean
  plannedWeekend: string
  organiserNextAction: string
}

export type PlayerPreLaunchState = 'guest' | 'no_entry' | 'awaiting_payment' | 'awaiting_verification' | 'entered_waiting'

export function derivePlayerPreLaunchState(
  entry: GameEntry | null | undefined,
): PlayerPreLaunchState {
  if (!entry) return 'no_entry'
  if (entry.paid && entry.status === 'active') return 'entered_waiting'
  if (entry.payment_claimed && !entry.paid) return 'awaiting_verification'
  return 'awaiting_payment'
}

export function buildLaunchReadinessStats(input: {
  registeredPlayerCount: number
  entries: GameEntryWithPlayer[]
  game: Game | null
  windows: SelectionWindowWithMeta[]
}): LaunchReadinessStats {
  const window2 = input.windows.find((window) => window.window_number === WINDOW2_NUMBER) ?? null
  const activePaidEntryCount = input.entries.filter((entry) => entry.paid && entry.status === 'active').length
  const awaitingVerificationCount = input.entries.filter((entry) => entry.payment_claimed && !entry.paid).length
  const notYetActiveEntryCount = input.entries.filter(
    (entry) => !(entry.paid && entry.status === 'active'),
  ).length

  return {
    registeredPlayerCount: input.registeredPlayerCount,
    activePaidEntryCount,
    awaitingVerificationCount,
    notYetActiveEntryCount,
    currentPot: input.game?.current_pot ?? 0,
    window2Status: window2 ? `${window2.status} · not live` : 'not created',
    window2Live: window2 ? shouldShowPlayerPickForm(window2) : false,
    plannedWeekend: WINDOW2_PLANNED_WEEKEND_LABEL,
    organiserNextAction: ORGANISER_NEXT_ACTION,
  }
}

export function buildWhatsAppLaunchNotice(appUrl = PUBLIC_LOS_APP_URL): string {
  return [
    `${APP_NAME} (Game ${CURRENT_GAME}) is moving to the app.`,
    '',
    'Please register and pay through the app:',
    appUrl,
    '',
    `Window 2 is planned for ${PRE_LAUNCH_WEEKEND_LABEL}. Picks are not open yet.`,
    '',
    'Once your payment is verified, you will receive the live selection prompt when the organiser opens the round.',
  ].join('\n')
}

export function isWindow2PendingDraft(window: SelectionWindowWithMeta | null | undefined): boolean {
  return Boolean(window && window.window_number === WINDOW2_NUMBER && isDraftOperationalWindow(window))
}
