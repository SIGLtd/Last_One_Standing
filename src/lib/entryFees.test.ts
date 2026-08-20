import { describe, expect, it } from 'vitest'
import type { Game, GameEntry } from '../types'
import {
  DEFAULT_NEWBIE_ENTRY_FEE,
  DEFAULT_STANDARD_ENTRY_FEE,
  formatEntryTypeLabel,
  getAmountDue,
  getDisplayAmountDue,
  isExplicitOrganiserNewbieFee,
} from './entryFees'

const game: Pick<Game, 'standard_entry_fee' | 'newbie_entry_fee'> = {
  standard_entry_fee: DEFAULT_STANDARD_ENTRY_FEE,
  newbie_entry_fee: DEFAULT_NEWBIE_ENTRY_FEE,
}

function entry(overrides: Partial<GameEntry> = {}): Pick<
  GameEntry,
  'entry_type' | 'entry_count' | 'fee_set_by_admin' | 'amount_due'
> {
  return {
    entry_type: 'existing',
    entry_count: 1,
    fee_set_by_admin: false,
    amount_due: 10,
    ...overrides,
  }
}

describe('entry fee display', () => {
  it('shows £10 for a returning player with one entry', () => {
    const returning = entry({ entry_type: 'existing', entry_count: 1, amount_due: 30 })
    expect(getDisplayAmountDue(returning, game)).toBe(10)
    expect(formatEntryTypeLabel('existing', 10)).toContain('£10')
  })

  it('shows £10 for a new or current player with one entry unless organiser config is applied', () => {
    const autoNewbie = entry({ entry_type: 'newbie', fee_set_by_admin: false, amount_due: 30 })
    expect(getDisplayAmountDue(autoNewbie, game)).toBe(10)
    expect(isExplicitOrganiserNewbieFee(autoNewbie as GameEntry)).toBe(false)

    const adminNewbie = entry({ entry_type: 'newbie', fee_set_by_admin: true, amount_due: 30 })
    expect(getDisplayAmountDue(adminNewbie, game)).toBe(30)
    expect(isExplicitOrganiserNewbieFee(adminNewbie as GameEntry)).toBe(true)
  })

  it('multiplies the standard fee when a player has multiple entries', () => {
    expect(getDisplayAmountDue(entry({ entry_type: 'existing', entry_count: 3 }), game)).toBe(30)
    expect(getAmountDue('existing', game, 2)).toBe(20)
    expect(getAmountDue('admin_comp', game, 3)).toBe(0)
  })

  it('keeps Admin and player-facing amounts on the same helper', () => {
    const playerFacing = getDisplayAmountDue(entry({ entry_type: 'existing' }), game)
    const adminFacing = getDisplayAmountDue(entry({ entry_type: 'existing' }), game)
    expect(playerFacing).toBe(adminFacing)
    expect(playerFacing).toBe(10)
  })
})
