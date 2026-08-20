import { describe, expect, it } from 'vitest'
import type { GameEntryWithPlayer, Selection, SelectionWindowEligibleFixture } from '../types'
import { ROUND1_LIVE_DEADLINE_UTC } from './round1'
import {
  buildSelectionCsv,
  buildSelectionExportRows,
  buildWhatsAppSelectionSummary,
} from './selectionExport'

const fixtures: SelectionWindowEligibleFixture[] = [
  {
    id: 'f1',
    window_id: 'w2',
    season_fixture_id: 'sf1',
    home_team_id: 'mci',
    away_team_id: 'tot',
    home_team_name: 'Manchester City',
    away_team_name: 'Tottenham Hotspur',
    kickoff_at: '2026-08-22T14:00:00.000Z',
    snapshot_kickoff_at: '2026-08-22T14:00:00.000Z',
    fixture_status: 'scheduled',
    created_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'f2',
    window_id: 'w2',
    season_fixture_id: 'sf2',
    home_team_id: 'liv',
    away_team_id: 'ars',
    home_team_name: 'Liverpool',
    away_team_name: 'Arsenal',
    kickoff_at: '2026-08-22T16:00:00.000Z',
    snapshot_kickoff_at: '2026-08-22T16:00:00.000Z',
    fixture_status: 'scheduled',
    created_at: '2026-08-01T00:00:00.000Z',
  },
]

function selection(overrides: Partial<Selection>): Selection {
  return {
    id: 's1',
    game_id: 'g1',
    window_id: 'w2',
    player_id: 'p1',
    team_id: 'mci',
    season_fixture_id: 'sf1',
    created_at: '2026-08-20T10:00:00.000Z',
    updated_at: '2026-08-20T11:00:00.000Z',
    locked_at: null,
    admin_corrected: false,
    corrected_by: null,
    correction_reason: null,
    ...overrides,
  }
}

function entry(overrides: Partial<GameEntryWithPlayer>): GameEntryWithPlayer {
  return {
    id: 'e1',
    game_id: 'g1',
    player_id: 'p1',
    entry_type: 'existing',
    amount_due: 10,
    payment_claimed: true,
    paid: true,
    paid_at: '2026-08-01T00:00:00.000Z',
    status: 'active',
    eliminated_reason: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    entry_count: 1,
    fee_set_by_admin: false,
    player: { display_name: 'Ben', phone: null, email: 'ben@example.com', is_admin: false, is_manual: false },
    ...overrides,
  }
}

describe('selection export', () => {
  it('formats a WhatsApp-friendly current-round summary and groups by team', () => {
    const rows = buildSelectionExportRows({
      selections: [
        selection({ id: 's1', player_id: 'p1', team_id: 'mci' }),
        selection({ id: 's2', player_id: 'p2', team_id: 'liv', admin_corrected: true, correction_reason: 'Entered by admin' }),
        selection({ id: 's3', player_id: 'p3', team_id: null }),
      ],
      entries: [
        entry({ player_id: 'p1', player: { display_name: 'Ben', phone: null, email: 'b@x.com', is_admin: false, is_manual: false } }),
        entry({
          id: 'e2',
          player_id: 'p2',
          player: { display_name: 'Iain', phone: null, email: null, is_admin: true, is_manual: true },
        }),
      ],
      fixtures,
      game: { standard_entry_fee: 10, newbie_entry_fee: 30 },
    })

    expect(rows).toHaveLength(2)
    expect(rows.some((row) => row.playerName === 'Ben' && row.teamName === 'Manchester City')).toBe(true)
    expect(rows.some((row) => row.adminEntered && row.playerName === 'Iain')).toBe(true)

    const text = buildWhatsAppSelectionSummary({
      roundLabel: 'Round 1',
      deadlineAt: ROUND1_LIVE_DEADLINE_UTC,
      rows,
    })

    expect(text).toContain('Round 1 selections so far')
    expect(text).toContain('Ben - Manchester City')
    expect(text).toContain('Iain - Liverpool (admin entered)')
    expect(text).toContain('Manchester City: Ben')
    expect(text).toContain('Liverpool: Iain')
    expect(text).toContain('4:00pm')
    expect(text).toContain('Friday')
  })

  it('downloads CSV of current valid selections only', () => {
    const rows = buildSelectionExportRows({
      selections: [selection({ team_id: 'tot', player_id: 'p1' })],
      entries: [entry()],
      fixtures,
      game: { standard_entry_fee: 10, newbie_entry_fee: 30 },
    })
    const csv = buildSelectionCsv({
      roundLabel: 'Round 1',
      deadlineAt: ROUND1_LIVE_DEADLINE_UTC,
      rows,
    })
    expect(csv.split('\n')[0]).toContain('Player')
    expect(csv).toContain('Ben')
    expect(csv).toContain('Tottenham Hotspur')
    expect(csv).not.toContain('Unknown player')
  })
})
