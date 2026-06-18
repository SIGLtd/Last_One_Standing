export type UUID = string

export type Player = {
  id: UUID
  user_id: UUID
  created_at: string
  updated_at: string
  display_name: string
  phone: string | null
  email: string
  is_admin: boolean
}

export type EntryType = 'existing' | 'newbie' | 'admin_comp'

export type EntryStatus = 'pending_payment' | 'active' | 'eliminated' | 'winner' | 'withdrawn'

export type Game = {
  id: UUID
  game_number: number
  season: string
  status: 'off_season' | 'open' | 'in_progress' | 'complete' | 'rolled_over'
  standard_entry_fee: number
  newbie_entry_fee: number
  rollover_contribution: number
  opening_pot: number
  current_pot: number
  winner_player_id: UUID | null
  result_type: string
  created_at: string
  opened_at: string | null
  closed_at: string | null
}

export type GameEntry = {
  id: UUID
  game_id: UUID
  player_id: UUID
  entry_type: EntryType
  amount_due: number
  payment_claimed: boolean
  paid: boolean
  paid_at: string | null
  status: EntryStatus
  eliminated_reason: string | null
  created_at: string
  updated_at: string
}

export type GameEntryWithPlayer = GameEntry & {
  player: Pick<Player, 'display_name' | 'phone' | 'email'>
}

export type SelectionWindowStatus = 'pending' | 'open' | 'locked' | 'resolving' | 'resolved'

export type SelectionWindow = {
  id: UUID
  game_id: UUID
  window_number: number
  start_at: string
  end_at: string
  deadline_at: string
  status: SelectionWindowStatus
  created_at: string
  updated_at: string
}

export type Team = {
  id: string
  name: string
}

export type Fixture = {
  id: UUID
  created_at: string
  game_id: UUID
  window_id: UUID
  kickoff_at: string
  home_team_id: string
  away_team_id: string
  status: 'scheduled' | 'in_play' | 'finished' | 'postponed'
}

export type Selection = {
  id: UUID
  game_id: UUID
  window_id: UUID
  player_id: UUID
  team_id: string | null
  created_at: string
  updated_at: string
  locked_at: string | null
  admin_corrected: boolean
  corrected_by: UUID | null
  correction_reason: string | null
}

export type WindowPickRow = {
  player_id: UUID
  display_name: string
  team_id: string | null
  locked_at: string | null
  entry_status: EntryStatus
}

export type HistoryResultType = 'winner' | 'rollover' | 'active'

export type HistoricalResult = {
  id: string
  game_number: number
  season: string
  result_type: HistoryResultType
  winner_name: string | null
  pot: number
  notes?: string | null
}

export type AdminAction = {
  id: UUID
  created_at: string
  actor_player_id: UUID
  action_type:
    | 'create_game'
    | 'update_game'
    | 'set_selection_window'
    | 'manual_selection_correction'
    | 'resolve_results'
    | 'update_history'
    | 'update_payment'
  entity_table: string
  entity_id: string
  payload: Record<string, unknown>
}

