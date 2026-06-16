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

export function formatGBP(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)
}

