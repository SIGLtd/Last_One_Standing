import {
  DEFAULT_NEWBIE_ENTRY_FEE,
  DEFAULT_ROLLOVER_CONTRIBUTION,
  DEFAULT_STANDARD_ENTRY_FEE,
} from './entryFees'

export const APP_NAME = 'Last One Standing'
export const APP_TAGLINE = 'Pick, survive, repeat.'

export const CURRENT_GAME = 27

/** Fallback copy only. Live amounts come from games.standard_entry_fee / newbie_entry_fee. */
export const FEES = {
  returning_player: DEFAULT_STANDARD_ENTRY_FEE,
  new_player: DEFAULT_NEWBIE_ENTRY_FEE,
  new_player_rollover_fairness_contribution: DEFAULT_ROLLOVER_CONTRIBUTION,
} as const

export const STATUS = {
  offSeason: true,
} as const

/** Eligible Premier League fixture days for weekly selections (organiser rule). */
export const ELIGIBLE_SELECTION_DAYS = ['Saturday', 'Sunday'] as const

export function formatEligibleSelectionDays(): string {
  const days = [...ELIGIBLE_SELECTION_DAYS]
  if (days.length === 0) return ''
  if (days.length === 1) return days[0]
  return `${days.slice(0, -1).join(', ')} and ${days.at(-1)}`
}

export const BANK_DETAILS = {
  bank: 'Santander',
  accountName: 'Iain Clark',
  sortCode: '09-01-28',
  accountNumber: '52706304',
} as const

export function formatGBP(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)
}

