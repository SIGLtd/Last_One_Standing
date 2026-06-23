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

export type SelectionWindowWithMeta = SelectionWindow & {
  eligible_sat_date: string | null
  eligible_sun_date: string | null
  review_outcome: 'deferred' | 'rejected' | null
  sync_run_id: UUID | null
  earliest_kickoff_at: string | null
  approved_at: string | null
  approved_by_player_id: UUID | null
}

export type SeasonFixture = {
  id: UUID
  season: string
  source_fixture_id: string | null
  canonical_key: string
  home_team_id: string
  away_team_id: string
  kickoff_at: string
  original_kickoff_at: string
  status: 'scheduled' | 'in_play' | 'finished' | 'postponed' | 'cancelled'
  home_score: number | null
  away_score: number | null
  result_status: string
  source_name: string
  source_url: string | null
  source_retrieved_at: string | null
  eligibility_override: 'none' | 'force_eligible' | 'force_ineligible'
  created_at: string
  updated_at: string
}

export type SelectionWindowEligibleFixture = {
  id: UUID
  window_id: UUID
  season_fixture_id: UUID
  home_team_id: string
  away_team_id: string
  home_team_name: string
  away_team_name: string
  kickoff_at: string
  snapshot_kickoff_at: string
  fixture_status: SeasonFixture['status']
  created_at: string
}

export type FixtureSyncRun = {
  id: UUID
  source_type: 'manual' | 'official_import' | 'api_football'
  source_url: string | null
  retrieved_at: string
  validation_status: 'running' | 'passed' | 'failed'
  run_result: string
  fixture_total: number
  changes_detected: number
  error_summary: string | null
  game_id: UUID | null
  target_sat_date: string | null
  target_sun_date: string | null
  created_at: string
}

export type FixtureChangeEvent = {
  id: UUID
  sync_run_id: UUID
  season_fixture_id: UUID | null
  change_type: string
  old_values: Record<string, unknown>
  new_values: Record<string, unknown>
  affects_open_window: boolean
  affected_window_id: UUID | null
  resolution_status: 'pending' | 'acknowledged' | 'resolved' | 'ignored'
  created_at: string
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
  season_fixture_id: UUID | null
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

