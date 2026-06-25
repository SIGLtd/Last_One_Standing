import { describe, expect, it } from 'vitest'
import type { GameEntry } from '../types'
import { ADMIN_COCKPIT_SECTION_ORDER } from './adminCockpit'
import {
  CURRENT_PICKS_ROUND_OPEN_INTRO,
  PLAYER_COMPLETE_ENTRY_MESSAGE,
  PLAYER_ROUND1_OPEN_MESSAGE,
  PUBLIC_ROUND1_OPEN_POINTS,
  PROVIDER_STATUS_COPY,
  buildWhatsAppRound1OpenNotice,
  derivePlayerEntryState,
} from './round1'
import { shouldShowPlayerPickForm } from './window2Draft'

describe('round 1 player experience', () => {
  it('shows Round 1 open copy without technical window labels', () => {
    expect(PUBLIC_ROUND1_OPEN_POINTS.some((point) => point.includes('Round 1'))).toBe(true)
    expect(PUBLIC_ROUND1_OPEN_POINTS.some((point) => point.includes('11:30 BST'))).toBe(true)
    expect(PUBLIC_ROUND1_OPEN_POINTS.some((point) => point.toLowerCase().includes('whatsapp'))).toBe(true)
    expect(PUBLIC_ROUND1_OPEN_POINTS.join(' ')).not.toContain('Window 2')
    expect(PUBLIC_ROUND1_OPEN_POINTS.join(' ')).not.toContain('pending')
    expect(PLAYER_ROUND1_OPEN_MESSAGE).toContain('Round 1')
  })

  it('does not claim automatic external fixture monitoring', () => {
    const notice = buildWhatsAppRound1OpenNotice()
    expect(notice.toLowerCase()).not.toContain('automatic')
    expect(notice.toLowerCase()).not.toContain('football-data')
    expect(PROVIDER_STATUS_COPY.automatedDetectionInactive.toLowerCase()).toContain('not currently active')
  })

  it('routes unpaid or inactive users away from picking', () => {
    expect(derivePlayerEntryState(null, true)).toBe('no_entry')
    expect(derivePlayerEntryState({ paid: false, payment_claimed: false, status: 'pending_payment' } as GameEntry, true)).toBe(
      'awaiting_payment',
    )
    expect(
      derivePlayerEntryState({ paid: false, payment_claimed: true, status: 'pending_payment' } as GameEntry, true),
    ).toBe('awaiting_verification')
    expect(derivePlayerEntryState({ paid: true, status: 'active' } as GameEntry, true)).toBe('entered_can_pick')
    expect(derivePlayerEntryState({ paid: true, status: 'active' } as GameEntry, false)).toBe('entered_waiting')
  })

  it('allows current picks without requiring your own selection first', () => {
    expect(CURRENT_PICKS_ROUND_OPEN_INTRO.toLowerCase()).toContain('do not need to submit your own pick first')
  })

  it('keeps payment next-action copy for incomplete entries', () => {
    expect(PLAYER_COMPLETE_ENTRY_MESSAGE).toContain('pay')
    expect(PLAYER_COMPLETE_ENTRY_MESSAGE).toContain('verified')
  })

  it('blocks pick form while the operational window is still pending', () => {
    expect(shouldShowPlayerPickForm({ window_number: 2, status: 'pending' })).toBe(false)
  })
})

describe('mobile admin cockpit structure', () => {
  it('places round control before advanced operations', () => {
    expect(ADMIN_COCKPIT_SECTION_ORDER[0]).toBe('round_control')
    expect(ADMIN_COCKPIT_SECTION_ORDER.at(-1)).toBe('advanced_operations')
    expect(ADMIN_COCKPIT_SECTION_ORDER.indexOf('round_control')).toBeLessThan(
      ADMIN_COCKPIT_SECTION_ORDER.indexOf('advanced_operations'),
    )
  })
})
