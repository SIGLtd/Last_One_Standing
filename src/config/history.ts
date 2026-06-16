import type { HistoricalResult } from '../types'

// Seeded placeholder history (no external APIs yet)
export const HISTORY_GAMES_1_TO_27: HistoricalResult[] = Array.from({ length: 27 }, (_, i) => {
  const gameNumber = i + 1
  return {
    id: `g${gameNumber}`,
    game_number: gameNumber,
    ended_at: null,
    outcome: gameNumber === 27 ? 'in_progress' : 'rollover_or_winner_unknown',
    notes:
      gameNumber === 27
        ? 'Current game. Live selections only.'
        : 'Seeded placeholder result. Add real outcomes in Admin later.',
  }
})

