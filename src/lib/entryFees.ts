import type { EntryType, Game, GameEntry } from '../types'

export const DEFAULT_STANDARD_ENTRY_FEE = 10
export const DEFAULT_NEWBIE_ENTRY_FEE = 30
export const DEFAULT_ROLLOVER_CONTRIBUTION = 20

export type FeeInputs = {
  entry_type: EntryType
  entry_count?: number | null
  fee_set_by_admin?: boolean | null
  amount_due?: number | null
}

function standardFee(game: Pick<Game, 'standard_entry_fee'>): number {
  return game.standard_entry_fee
}

function newbieFee(game: Pick<Game, 'newbie_entry_fee'>): number {
  return game.newbie_entry_fee
}

export function normalisedEntryCount(entryCount?: number | null): number {
  const count = entryCount ?? 1
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 1
}

/** Amount due from the live game fee configuration. */
export function getAmountDue(
  entryType: EntryType,
  game: Pick<Game, 'standard_entry_fee' | 'newbie_entry_fee'>,
  entryCount?: number | null,
): number {
  const count = normalisedEntryCount(entryCount)

  switch (entryType) {
    case 'admin_comp':
      return 0
    case 'newbie':
      return newbieFee(game) * count
    case 'existing':
      return standardFee(game) * count
  }
}

/**
 * Player-facing and Admin amount. Auto-created newbie rows still display the
 * standard per-entry fee until an organiser explicitly applies the newbie rule.
 * Does not write payment records.
 */
export function getDisplayAmountDue(
  entry: FeeInputs,
  game: Pick<Game, 'standard_entry_fee' | 'newbie_entry_fee'>,
): number {
  const count = normalisedEntryCount(entry.entry_count)

  if (entry.entry_type === 'admin_comp') return 0

  if (entry.fee_set_by_admin) {
    return getAmountDue(entry.entry_type, game, count)
  }

  return standardFee(game) * count
}

export function formatEntryTypeLabel(entryType: EntryType, amountGbp: number): string {
  switch (entryType) {
    case 'existing':
      return `Returning (${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amountGbp)})`
    case 'newbie':
      return `New (${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amountGbp)})`
    case 'admin_comp':
      return 'Comp (free)'
  }
}

export function gameFromDefaults(overrides: Partial<Game> = {}): Pick<Game, 'standard_entry_fee' | 'newbie_entry_fee'> {
  return {
    standard_entry_fee: overrides.standard_entry_fee ?? DEFAULT_STANDARD_ENTRY_FEE,
    newbie_entry_fee: overrides.newbie_entry_fee ?? DEFAULT_NEWBIE_ENTRY_FEE,
  }
}

export function isExplicitOrganiserNewbieFee(entry: Pick<GameEntry, 'entry_type' | 'fee_set_by_admin'>): boolean {
  return entry.entry_type === 'newbie' && Boolean(entry.fee_set_by_admin)
}
