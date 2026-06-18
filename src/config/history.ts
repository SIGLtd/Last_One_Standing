import type { HistoricalResult } from '../types'

const SEASON = '2025/26'

function game(
  gameNumber: number,
  resultType: HistoricalResult['result_type'],
  pot: number,
  winnerName: string | null = null,
  notes?: string,
): HistoricalResult {
  return {
    id: `g${gameNumber}`,
    game_number: gameNumber,
    season: SEASON,
    result_type: resultType,
    winner_name: winnerName,
    pot,
    notes: notes ?? null,
  }
}

export const HISTORY_GAMES_1_TO_27: HistoricalResult[] = [
  game(1, 'winner', 170, 'Virge'),
  game(2, 'winner', 210, 'Barney'),
  game(3, 'rollover', 340),
  game(4, 'rollover', 880),
  game(5, 'rollover', 1350),
  game(6, 'winner', 1840, 'Dan'),
  game(7, 'winner', 600, 'Branners'),
  game(8, 'winner', 380, 'Josh C'),
  game(9, 'winner', 450, 'Craigo'),
  game(10, 'winner', 550, 'Susie'),
  game(11, 'rollover', 490),
  game(12, 'winner', 1130, 'Sturge'),
  game(13, 'winner', 560, 'George C'),
  game(14, 'winner', 510, 'Pat'),
  game(15, 'winner', 640, 'Neil'),
  game(16, 'winner', 650, 'Josh E'),
  game(17, 'rollover', 650),
  game(18, 'winner', 1350, 'Greg T'),
  game(19, 'rollover', 660),
  game(20, 'winner', 1560, 'Adam'),
  game(21, 'winner', 950, 'Craigo', 'second time winner'),
  game(22, 'winner', 1000, 'Chris'),
  game(23, 'winner', 950, 'Kain'),
  game(24, 'winner', 860, 'Josh T'),
  game(25, 'rollover', 890),
  game(26, 'rollover', 1000),
  game(27, 'active', 1920),
]

export function getHistorySummary(history: HistoricalResult[]) {
  const winners = history.filter((row) => row.result_type === 'winner')
  const rollovers = history.filter((row) => row.result_type === 'rollover')

  const totalPaidOut = winners.reduce((sum, row) => sum + row.pot, 0)
  const biggestWin = winners.reduce((max, row) => (row.pot > max.pot ? row : max), winners[0])

  const winCountByName = winners.reduce<Record<string, number>>((acc, row) => {
    if (!row.winner_name) return acc
    acc[row.winner_name] = (acc[row.winner_name] ?? 0) + 1
    return acc
  }, {})

  const repeatWinners = Object.entries(winCountByName)
    .filter(([, count]) => count > 1)
    .map(([name, count]) => `${name} (${count})`)
    .join(', ')

  return {
    totalPaidOut,
    biggestWin,
    rolloverCount: rollovers.length,
    repeatWinners: repeatWinners || '—',
  }
}
