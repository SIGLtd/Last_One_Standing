export const APP_NAME = 'Last One Standing'

export const CURRENT_GAME = 27
export const CURRENT_POT_GBP = 1920

export const FEES = {
  returning_player: 10,
  new_player: 30,
  new_player_rollover_fairness_contribution: 20,
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

