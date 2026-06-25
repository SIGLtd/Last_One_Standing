import { describe, expect, it } from 'vitest'
import type { Game, GameEntry, GameEntryWithPlayer, SelectionWindowWithMeta } from '../types'
import {
  CURRENT_PICKS_PRE_LAUNCH_MESSAGE,
  PUBLIC_APP_INTRO,
  PUBLIC_PRE_LAUNCH_POINTS,
  PLAYER_PICKS_NOT_OPEN_MESSAGE,
  buildLaunchReadinessStats,
  buildWhatsAppLaunchNotice,
  derivePlayerPreLaunchState,
} from './preLaunch'
import { shouldShowPlayerPickForm } from './window2Draft'

function entry(overrides: Partial<GameEntryWithPlayer> = {}): GameEntryWithPlayer {
  return {
    id: 'e1',
    game_id: 'g1',
    player_id: 'p1',
    entry_type: 'existing',
    amount_due: 10,
    payment_claimed: false,
    paid: false,
    paid_at: null,
    status: 'pending_payment',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    player: { id: 'p1', display_name: 'Test', email: 't@example.com', phone: null, is_admin: false },
    ...overrides,
  }
}

const game: Game = {
  id: 'g1',
  game_number: 27,
  season: '2026/27',
  status: 'open',
  standard_entry_fee: 10,
  newbie_entry_fee: 30,
  rollover_contribution: 20,
  opening_pot: 1920,
  current_pot: 1920,
  winner_player_id: null,
  result_type: null,
  created_at: '2026-01-01T00:00:00.000Z',
  opened_at: null,
  closed_at: null,
}

const pendingWindow2: SelectionWindowWithMeta = {
  id: 'w2',
  game_id: 'g1',
  window_number: 2,
  status: 'pending',
  start_at: '2026-08-20T11:30:00.000Z',
  end_at: '2026-08-24T11:30:00.000Z',
  deadline_at: '2026-08-22T10:30:00.000Z',
  eligible_sat_date: '2026-08-22',
  eligible_sun_date: '2026-08-23',
  review_outcome: null,
  sync_run_id: null,
  earliest_kickoff_at: '2026-08-22T11:30:00.000Z',
  approved_at: null,
  approved_by_player_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

describe('pre-launch onboarding', () => {
  it('shows public registration and pre-launch information for guests', () => {
    expect(PUBLIC_APP_INTRO).toContain('register')
    expect(PUBLIC_APP_INTRO).toContain('pay')
    expect(PUBLIC_PRE_LAUNCH_POINTS.some((point) => point.includes('22 to 23 August 2026'))).toBe(true)
    expect(PUBLIC_PRE_LAUNCH_POINTS.some((point) => point.toLowerCase().includes('not open'))).toBe(true)
    expect(PUBLIC_PRE_LAUNCH_POINTS.some((point) => point.includes('deadline will be confirmed'))).toBe(true)
    expect(PUBLIC_PRE_LAUNCH_POINTS.some((point) => point.includes('11:30'))).toBe(false)
  })

  it('shows entered-but-waiting state for paid active players without a pick form', () => {
    const state = derivePlayerPreLaunchState({
      paid: true,
      status: 'active',
    } as GameEntry)
    expect(state).toBe('entered_waiting')
    expect(shouldShowPlayerPickForm(pendingWindow2)).toBe(false)
    expect(PLAYER_PICKS_NOT_OPEN_MESSAGE.toLowerCase()).toContain('not open')
  })

  it('routes unpaid or unverified players to the correct next action', () => {
    expect(derivePlayerPreLaunchState(null)).toBe('no_entry')
    expect(derivePlayerPreLaunchState({ paid: false, payment_claimed: false, status: 'pending_payment' } as GameEntry)).toBe(
      'awaiting_payment',
    )
    expect(
      derivePlayerPreLaunchState({ paid: false, payment_claimed: true, status: 'pending_payment' } as GameEntry),
    ).toBe('awaiting_verification')
  })

  it('provides helpful copy when no open window exists on pick and current-picks routes', () => {
    expect(PLAYER_PICKS_NOT_OPEN_MESSAGE.length).toBeGreaterThan(20)
    expect(CURRENT_PICKS_PRE_LAUNCH_MESSAGE).toContain('appear here automatically')
    expect(CURRENT_PICKS_PRE_LAUNCH_MESSAGE.toLowerCase()).not.toContain('you must')
  })

  it('derives read-only admin launch readiness values without mutating data', () => {
    const stats = buildLaunchReadinessStats({
      registeredPlayerCount: 12,
      entries: [
        entry({ paid: true, status: 'active' }),
        entry({ id: 'e2', payment_claimed: true, paid: false, status: 'pending_payment' }),
        entry({ id: 'e3', paid: false, status: 'pending_payment' }),
      ],
      game,
      windows: [pendingWindow2],
    })

    expect(stats.registeredPlayerCount).toBe(12)
    expect(stats.activePaidEntryCount).toBe(1)
    expect(stats.awaitingVerificationCount).toBe(1)
    expect(stats.notYetActiveEntryCount).toBe(2)
    expect(stats.currentPot).toBe(1920)
    expect(stats.window2Status).toContain('pending')
    expect(stats.window2Live).toBe(false)
    expect(stats.organiserNextAction).toContain('Revalidate')
  })

  it('builds a safe WhatsApp notice without payment or provider details', () => {
    const notice = buildWhatsAppLaunchNotice()
    expect(notice).toContain('register and pay through the app')
    expect(notice).toContain('22')
    expect(notice.toLowerCase()).toContain('not open')
    expect(notice).not.toContain('Santander')
    expect(notice).not.toContain('football-data')
    expect(notice).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  })
})
