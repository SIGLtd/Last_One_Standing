import { describe, expect, it } from 'vitest'
import {
  countSubmittedPicksByWindowId,
  getAdminLiveOpenWindow,
  getAdminResolutionWindow,
} from './adminResolutionWindow'
import { isProtectedHistoricWindow } from './windowGuards'

const historic = {
  id: 'w1',
  window_number: 1,
  status: 'open' as const,
  deadline_at: '2026-06-17T12:00:00.000Z',
}

const round1Resolved = {
  id: 'w2',
  window_number: 2,
  status: 'resolved' as const,
  deadline_at: '2026-08-21T15:00:00.000Z',
}

const round2Open = {
  id: 'w3',
  window_number: 3,
  status: 'open' as const,
  deadline_at: '2026-08-28T15:00:00.000Z',
}

const round1Open = {
  id: 'w2-open',
  window_number: 2,
  status: 'open' as const,
  deadline_at: '2026-08-21T15:00:00.000Z',
}

describe('admin resolution window selection', () => {
  it('excludes protected Window 1', () => {
    expect(isProtectedHistoricWindow(1)).toBe(true)
    expect(getAdminResolutionWindow([historic], Date.parse('2026-08-24T18:30:00.000Z'))).toBeNull()
    expect(getAdminLiveOpenWindow([historic])).toBeNull()
  })

  it('selects unresolved Round 1 instead of a future next window', () => {
    const selected = getAdminResolutionWindow(
      [historic, round1Open, round2Open],
      Date.parse('2026-08-24T18:30:00.000Z'),
    )
    expect(selected?.id).toBe('w2-open')
  })

  it('audits just-resolved Round 1 when Round 2 is already open and its deadline has not passed', () => {
    const now = Date.parse('2026-08-24T18:30:00.000Z')
    const selected = getAdminResolutionWindow([historic, round1Resolved, round2Open], now)
    expect(selected?.id).toBe('w2')
    expect(selected?.status).toBe('resolved')
    expect(getAdminLiveOpenWindow([historic, round1Resolved, round2Open])?.id).toBe('w3')
  })

  it('selects Round 2 once its deadline has passed', () => {
    const selected = getAdminResolutionWindow(
      [historic, round1Resolved, round2Open],
      Date.parse('2026-08-28T16:00:00.000Z'),
    )
    expect(selected?.id).toBe('w3')
  })

  it('counts submitted picks by the selected window_id', () => {
    const selections = [
      { window_id: 'w2', team_id: 'mci' },
      { window_id: 'w2', team_id: 'mun' },
      { window_id: 'w2', team_id: null },
      { window_id: 'w3', team_id: 'liv' },
    ]
    expect(countSubmittedPicksByWindowId(selections, 'w2')).toBe(2)
    expect(countSubmittedPicksByWindowId(selections, 'w3')).toBe(1)
  })
})
