import { describe, expect, it } from 'vitest'
import { buildPickHistoryRows } from './pickHistory'
import type { Selection } from '../types'

function row(
  overrides: Partial<Selection> & {
    window?: { window_number: number; status: string; deadline_at: string }
    fixture?: { home_team_id: string; away_team_id: string }
    player_id?: string
  },
) {
  return {
    id: 's1',
    game_id: 'g1',
    window_id: 'w2',
    player_id: 'me',
    team_id: 'liv',
    season_fixture_id: 'sf1',
    created_at: '2026-08-20T10:00:00.000Z',
    updated_at: '2026-08-20T10:30:00.000Z',
    locked_at: null,
    admin_corrected: false,
    corrected_by: null,
    correction_reason: null,
    window: { window_number: 2, status: 'open', deadline_at: '2026-08-21T15:00:00.000Z' },
    fixture: { home_team_id: 'liv', away_team_id: 'ars' },
    ...overrides,
  }
}

describe('pick history', () => {
  it('returns only the requested player rows', () => {
    const mine = buildPickHistoryRows([row({ id: 'mine', player_id: 'me' })])
    expect(mine).toHaveLength(1)
    expect(mine.every((item) => item.playerId === 'me')).toBe(true)
  })

  it('marks admin-entered picks in the player history', () => {
    const rows = buildPickHistoryRows([
      row({
        admin_corrected: true,
        correction_reason: 'Entered by admin on behalf of player',
        corrected_by: 'admin-id',
      }),
    ])
    expect(rows[0]?.adminEntered).toBe(true)
    expect(rows[0]?.teamName).toBe('Liverpool')
    expect(rows[0]?.roundLabel).toBe('Round 1')
  })

  it('builds an empty list for an empty history', () => {
    expect(buildPickHistoryRows([])).toEqual([])
  })
})
