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

export type Game = {
  id: UUID
  created_at: string
  game_number: number
  pot_gbp: number
  status: 'off_season' | 'open' | 'in_progress' | 'complete' | 'rolled_over'
  notes?: string | null
}

export type GameEntry = {
  id: UUID
  created_at: string
  game_id: UUID
  player_id: UUID
  entry_type: 'returning' | 'new'
  amount_due_gbp: number
  amount_paid_gbp: number
  payment_status: 'unpaid' | 'partial' | 'paid' | 'waived'
}

export type SelectionWindow = {
  id: UUID
  created_at: string
  game_id: UUID
  window_number: number
  opens_at: string
  locks_at: string
  status: 'upcoming' | 'open' | 'locked' | 'complete' | 'cancelled'
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
  created_at: string
  updated_at: string
  game_id: UUID
  window_id: UUID
  player_id: UUID
  team_id: string | null
  status: 'no_pick' | 'submitted' | 'locked'
  locked_at?: string | null
}

export type HistoricalResult = {
  id: string
  game_number: number
  ended_at: string | null
  outcome: 'winner_unknown' | 'rollover_or_winner_unknown' | 'rolled_over' | 'winner_declared' | 'in_progress'
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

