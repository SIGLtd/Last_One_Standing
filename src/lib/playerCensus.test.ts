import { describe, expect, it } from 'vitest'
import type { GameEntryWithPlayer, Player } from '../types'
import { buildPlayerCensus, describeRegisteredVsActive } from './playerCensus'

function player(overrides: Partial<Player>): Player {
  return {
    id: 'p1',
    user_id: 'u1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    display_name: 'Player',
    phone: null,
    email: 'p@example.com',
    is_admin: false,
    is_manual: false,
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
    payment_claimed: false,
    paid: true,
    paid_at: '2026-01-01T00:00:00.000Z',
    status: 'active',
    eliminated_reason: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    entry_count: 1,
    fee_set_by_admin: false,
    player: { display_name: 'Player', phone: null, email: 'p@example.com', is_admin: false, is_manual: false },
    ...overrides,
  }
}

describe('player census', () => {
  it('explains one extra registered player when the admin is not a live entrant', () => {
    const players = [
      player({ id: 'admin', user_id: 'ua', display_name: 'Iain', email: 'iain@example.com', is_admin: true }),
      player({ id: 'ben', user_id: 'ub', display_name: 'Ben', email: 'ben@example.com' }),
    ]
    const entries = [
      entry({
        id: 'e-ben',
        player_id: 'ben',
        player: { display_name: 'Ben', phone: null, email: 'ben@example.com', is_admin: false, is_manual: false },
      }),
    ]

    const census = buildPlayerCensus(players, entries)
    expect(census.registered).toBe(2)
    expect(census.activeEntrants).toBe(1)
    expect(census.paidVerified).toBe(1)
    expect(census.adminBuildOnly).toBe(1)
    expect(census.inactive).toBe(1)
    expect(describeRegisteredVsActive(census)).toContain('admin/build-only')
  })

  it('counts manual players and unpaid rows separately without hiding them', () => {
    const players = [
      player({ id: 'm1', user_id: null, display_name: 'Offline', email: null, is_manual: true }),
      player({ id: 'u1', display_name: 'Unpaid', email: 'u@example.com' }),
    ]
    const entries = [
      entry({
        id: 'e-m',
        player_id: 'm1',
        paid: false,
        paid_at: null,
        status: 'active',
        player: { display_name: 'Offline', phone: null, email: null, is_admin: false, is_manual: true },
      }),
      entry({
        id: 'e-u',
        player_id: 'u1',
        paid: false,
        paid_at: null,
        status: 'pending_payment',
        player: { display_name: 'Unpaid', phone: null, email: 'u@example.com', is_admin: false, is_manual: false },
      }),
    ]

    const census = buildPlayerCensus(players, entries)
    expect(census.registered).toBe(2)
    expect(census.activeEntrants).toBe(1)
    expect(census.paidVerified).toBe(0)
    expect(census.manualOffline).toBe(1)
    expect(census.awaitingPayment).toBe(2)
    expect(census.inactive).toBe(1)
  })
})
