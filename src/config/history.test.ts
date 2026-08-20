import { describe, expect, it } from 'vitest'
import { HISTORY_GAMES_1_TO_27, formatHistorySeason } from './history'

describe('historic winner seasons', () => {
  it('does not claim every historic game is 2025/26', () => {
    expect(HISTORY_GAMES_1_TO_27.every((row) => row.season === '2025/26')).toBe(false)
  })

  it('uses the confirmed Game 27 season and TBC for unconfirmed earlier games', () => {
    const current = HISTORY_GAMES_1_TO_27.find((row) => row.game_number === 27)
    expect(current?.season).toBe('2026/27')
    expect(formatHistorySeason(current!)).toBe('2026/27')

    const first = HISTORY_GAMES_1_TO_27.find((row) => row.game_number === 1)
    expect(first?.season).toBeNull()
    expect(formatHistorySeason(first!)).toBe('TBC')
  })
})
