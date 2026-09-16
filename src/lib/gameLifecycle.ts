import { formatGBP } from './constants'
import { findNextPremierLeagueWeekend, type OpenNextRoundCheck } from './nextRound'
import { MIN_OPERATIONAL_WINDOW_NUMBER } from './windowGuards'
import type { CompletionType, Game, GameEntry, GameStatus, HistoricalResult, SeasonFixture, SelectionWindowWithMeta } from '../types'

export const COMPLETION_TYPES = ['winner_paid', 'rollover'] as const

export const WINNER_PAID_COPY =
  'Use this when someone has won the money. The next game will start clean unless you add an opening pot manually.'

export const ROLLOVER_COPY =
  'Use this when the money has not been won and the pot should carry into the next game.'

export const GAME_HAS_WINNER_COPY = 'This game has a winner. Complete the game before starting a new one.'

export const LIVE_GAME_STATUSES: GameStatus[] = ['open', 'in_progress']
export const COMPLETED_GAME_STATUSES: GameStatus[] = ['complete', 'rolled_over']

export function isLiveGameStatus(status: string | null | undefined): boolean {
  return status === 'open' || status === 'in_progress'
}

export function isCompletedGameStatus(status: string | null | undefined): boolean {
  return status === 'complete' || status === 'rolled_over'
}

export function isCompletedGame(game: Pick<Game, 'status'> | null | undefined): boolean {
  return Boolean(game && isCompletedGameStatus(game.status))
}

export function isWinnerPaid(game: Pick<Game, 'status' | 'result_type'>): boolean {
  return game.result_type === 'winner_paid' || (game.status === 'complete' && game.result_type !== 'rollover')
}

export function isRolloverCompletion(game: Pick<Game, 'status' | 'result_type'>): boolean {
  return game.result_type === 'rollover' || game.status === 'rolled_over'
}

export function completeGameWarning(gameNumber: number): string {
  return `This will close Game ${gameNumber} and preserve all picks, outcomes and payment records. It will not start a new round in this game.`
}

export function selectCurrentGame<T extends { status: string; game_number: number }>(games: T[]): T | null {
  const live = games
    .filter((game) => isLiveGameStatus(game.status))
    .sort((a, b) => b.game_number - a.game_number)
  if (live[0]) return live[0]
  return games.slice().sort((a, b) => b.game_number - a.game_number)[0] ?? null
}

export type SurvivorEntry = Pick<GameEntry, 'player_id' | 'paid' | 'status'>

export function survivingEntries<T extends SurvivorEntry>(entries: T[]): T[] {
  return entries.filter((entry) => entry.paid && entry.status === 'active')
}

export function gameHasDetectedWinner(survivorCount: number): boolean {
  return survivorCount === 1
}

export type CompleteGameDraft = {
  completionType: CompletionType
  winnerPlayerId: string | null
  winnerIsSurvivor: boolean
  nonSurvivorReason: string
  finalPot: number
  prizePaidAmount: number
  rolloverAmount: number
  notes: string
  currentPot: number
  gameStatus: string
}

export type CompleteGameNormalized = {
  completionType: CompletionType
  winnerPlayerId: string | null
  finalPot: number
  prizePaidAmount: number
  rolloverAmount: number
  notes: string
  nonSurvivorReason: string | null
}

export function defaultPrizePaid(finalPot: number): number {
  return finalPot
}

export function defaultRolloverAmount(currentPot: number): number {
  return currentPot
}

export function validateCompleteGame(draft: CompleteGameDraft): { ok: true; value: CompleteGameNormalized } | { ok: false; error: string } {
  if (isCompletedGameStatus(draft.gameStatus)) {
    return { ok: false, error: 'This game is already complete.' }
  }

  if (draft.completionType !== 'winner_paid' && draft.completionType !== 'rollover') {
    return { ok: false, error: 'Choose Winner paid or Rollover.' }
  }

  if (draft.completionType === 'winner_paid') {
    if (!draft.winnerPlayerId) {
      return { ok: false, error: 'Winner paid requires a winner.' }
    }
    if (!draft.winnerIsSurvivor && !draft.nonSurvivorReason.trim()) {
      return { ok: false, error: 'Choosing a winner who is not a final survivor needs an explicit reason.' }
    }
    if (draft.finalPot < 0 || draft.prizePaidAmount < 0) {
      return { ok: false, error: 'Final pot and prize paid must be zero or more.' }
    }
    if (draft.rolloverAmount > 0) {
      return { ok: false, error: 'Winner paid cannot also record a rollover amount. The next game starts clean.' }
    }
    return {
      ok: true,
      value: {
        completionType: 'winner_paid',
        winnerPlayerId: draft.winnerPlayerId,
        finalPot: draft.finalPot,
        prizePaidAmount: draft.prizePaidAmount,
        rolloverAmount: 0,
        notes: draft.notes.trim(),
        nonSurvivorReason: draft.winnerIsSurvivor ? null : draft.nonSurvivorReason.trim(),
      },
    }
  }

  if (draft.winnerPlayerId) {
    return { ok: false, error: 'Rollover does not record a paid winner.' }
  }
  if (draft.rolloverAmount < 0) {
    return { ok: false, error: 'Rollover amount must be zero or more.' }
  }
  if (!draft.notes.trim()) {
    return { ok: false, error: 'Add a short reason when the pot rolls into the next game.' }
  }

  return {
    ok: true,
    value: {
      completionType: 'rollover',
      winnerPlayerId: null,
      finalPot: draft.finalPot,
      prizePaidAmount: 0,
      rolloverAmount: draft.rolloverAmount,
      notes: draft.notes.trim(),
      nonSurvivorReason: null,
    },
  }
}

export function defaultOpeningPotForNewGame(previous: Pick<Game, 'result_type' | 'status' | 'rollover_amount' | 'current_pot'>): number {
  if (isRolloverCompletion(previous)) {
    return previous.rollover_amount ?? previous.current_pot
  }
  return 0
}

export function nextGameNumber(previousGameNumber: number): number {
  return previousGameNumber + 1
}

export function newGameLinksPrevious(previousGameId: string): { previous_game_id: string } {
  return { previous_game_id: previousGameId }
}

export function rolloverSourceFields(previous: Pick<Game, 'id' | 'game_number' | 'result_type' | 'status'>): {
  rolled_from_game_id: string | null
  rolled_from_game_number: number | null
} {
  if (!isRolloverCompletion(previous)) {
    return { rolled_from_game_id: null, rolled_from_game_number: null }
  }
  return { rolled_from_game_id: previous.id, rolled_from_game_number: previous.game_number }
}

export function buildCarryForwardEntries<T extends { player_id: string }>(
  previousEntries: T[],
  amountDue: number,
): Array<{
  player_id: string
  entry_type: 'existing'
  amount_due: number
  payment_claimed: false
  paid: false
  status: 'pending_payment'
  eliminated_reason: null
}> {
  const seen = new Set<string>()
  return previousEntries
    .filter((entry) => {
      if (seen.has(entry.player_id)) return false
      seen.add(entry.player_id)
      return true
    })
    .map((entry) => ({
      player_id: entry.player_id,
      entry_type: 'existing' as const,
      amount_due: amountDue,
      payment_claimed: false as const,
      paid: false as const,
      status: 'pending_payment' as const,
      eliminated_reason: null,
    }))
}

export function canOpenFirstRound(input: {
  gameStatus: string
  windows: Array<Pick<SelectionWindowWithMeta, 'status' | 'window_number' | 'eligible_sat_date' | 'eligible_sun_date'>>
  fixtures: SeasonFixture[]
  afterLondonDate: string
}): OpenNextRoundCheck {
  if (!isLiveGameStatus(input.gameStatus)) {
    return {
      canOpen: false,
      reason: 'Complete the previous game and start the new game before opening Round 1.',
      survivorCount: 0,
      alreadyOpen: false,
      weekend: null,
    }
  }

  const existing = input.windows.find((window) => window.window_number >= MIN_OPERATIONAL_WINDOW_NUMBER)
  if (existing) {
    return {
      canOpen: false,
      reason: existing.status === 'resolved' ? 'This game already has a round. Use Open next round.' : 'Round 1 is already open for this game.',
      survivorCount: 0,
      alreadyOpen: true,
      weekend: null,
    }
  }

  const weekend = findNextPremierLeagueWeekend(input.fixtures, input.afterLondonDate)
  if (!weekend) {
    return {
      canOpen: false,
      reason: 'No eligible Saturday/Sunday Premier League weekend was found.',
      survivorCount: 0,
      alreadyOpen: false,
      weekend: null,
    }
  }

  if (weekend.eligible.length === 0) {
    return {
      canOpen: false,
      reason: 'Zero-fixture snapshots cannot be published.',
      survivorCount: 0,
      alreadyOpen: false,
      weekend,
    }
  }

  return {
    canOpen: true,
    reason: null,
    survivorCount: 0,
    alreadyOpen: false,
    weekend,
  }
}

export type HomeCompletionView = {
  title: string
  winnerLine: string
  amountLine: string
  kind: CompletionType
}

export function homeCompletionView(game: Game): HomeCompletionView | null {
  if (!isCompletedGame(game)) return null

  if (isRolloverCompletion(game)) {
    const amount = game.rollover_amount ?? game.final_pot ?? game.current_pot
    return {
      title: `Game ${game.game_number} complete`,
          winnerLine: 'No winner — pot rolls over',
      amountLine: `Rollover pot: ${formatGBP(amount)}`,
      kind: 'rollover',
    }
  }

  const prize = game.prize_paid_amount ?? game.final_pot ?? game.current_pot
  return {
    title: `Game ${game.game_number} complete`,
    winnerLine: `Winner: ${game.winner_display_name ?? 'Winner'}`,
    amountLine: `Prize paid: ${formatGBP(prize)}`,
    kind: 'winner_paid',
  }
}

export function homeRolloverOpeningLabel(game: Pick<Game, 'opening_pot' | 'rolled_from_game_id' | 'rolled_from_game_number' | 'game_number'>): string | null {
  if (!game.rolled_from_game_id || !game.opening_pot) return null
  const fromNumber = game.rolled_from_game_number ?? game.game_number - 1
  return `Opening pot includes ${formatGBP(game.opening_pot)} rollover from Game ${fromNumber}`
}

export function historyOutcomeNote(row: HistoricalResult): string {
  if (row.result_type === 'winner') {
    const prize = row.prize_paid ?? row.pot
    const prizeLine = `Prize paid: ${formatGBP(prize)}`
    return row.notes ? `${prizeLine}. ${row.notes}` : prizeLine
  }
  if (row.result_type === 'rollover') {
    const amount = row.rollover_amount ?? row.pot
    const into = row.rolled_into_game_number
    const line = into
      ? `Rollover: ${formatGBP(amount)} carried into Game ${into}`
      : `Rollover: ${formatGBP(amount)}`
    return row.notes && !row.notes.startsWith('Rollover:') ? `${line}. ${row.notes}` : line
  }
  return row.notes ?? ''
}

export function liveGameToHistoryRow(game: Game, allLive: Game[]): HistoricalResult {
  if (isRolloverCompletion(game)) {
    const rolledInto =
      allLive.find((row) => row.rolled_from_game_id === game.id)?.game_number ??
      allLive.find((row) => row.previous_game_id === game.id)?.game_number ??
      null
    const amount = game.rollover_amount ?? game.final_pot ?? game.current_pot
    return {
      id: game.id,
      game_number: game.game_number,
      season: game.season,
      result_type: 'rollover',
      winner_name: null,
      pot: amount,
      notes: game.completion_notes,
      rollover_amount: amount,
      rolled_into_game_number: rolledInto,
    }
  }

  if (isWinnerPaid(game) && isCompletedGame(game)) {
    const prize = game.prize_paid_amount ?? game.final_pot ?? game.current_pot
    return {
      id: game.id,
      game_number: game.game_number,
      season: game.season,
      result_type: 'winner',
      winner_name: game.winner_display_name,
      pot: prize,
      notes: game.completion_notes,
      prize_paid: prize,
    }
  }

  return {
    id: game.id,
    game_number: game.game_number,
    season: game.season,
    result_type: 'active',
    winner_name: null,
    pot: game.current_pot,
    notes: null,
  }
}

export function mergeHistoryWithLiveGames(historic: HistoricalResult[], liveGames: Game[]): HistoricalResult[] {
  const byNumber = new Map(historic.map((row) => [row.game_number, row]))
  for (const game of liveGames) {
    byNumber.set(game.game_number, liveGameToHistoryRow(game, liveGames))
  }
  return [...byNumber.values()].sort((a, b) => a.game_number - b.game_number)
}

export function sampleGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'g27',
    game_number: 27,
    season: '2026/27',
    status: 'in_progress',
    standard_entry_fee: 10,
    newbie_entry_fee: 30,
    rollover_contribution: 20,
    opening_pot: 1920,
    current_pot: 2930,
    winner_player_id: null,
    winner_display_name: null,
    result_type: 'none',
    created_at: '2026-08-01T00:00:00.000Z',
    opened_at: '2026-08-01T00:00:00.000Z',
    closed_at: null,
    completed_at: null,
    final_pot: null,
    prize_paid_amount: null,
    rollover_amount: 0,
    completion_notes: null,
    previous_game_id: null,
    rolled_from_game_id: null,
    rolled_from_game_number: null,
    ...overrides,
  }
}
