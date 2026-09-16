import { getAmountDue as calculateAmountDue } from './entryFees'
import { isLiveGameStatus, selectCurrentGame } from './gameLifecycle'
import { getSupabaseOrThrow } from './supabase'
import type { CompletionType, EntryType, Game, GameEntry, GameEntryWithPlayer, Player } from '../types'

export { getAmountDue, getDisplayAmountDue } from './entryFees'

export async function adminFetchPlayers(): Promise<Player[]> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('players')
    .select('*')
    .order('display_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Player[]
}

export async function adminFetchRegisteredPlayerCount(): Promise<number> {
  const client = getSupabaseOrThrow()
  const { count, error } = await client.from('players').select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

export async function adminUpdateCurrentPot(gameId: string, currentPot: number): Promise<Game> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.rpc('admin_update_game_pot', {
    p_game_id: gameId,
    p_current_pot: currentPot,
  })
  if (error) throw error
  return data as Game
}

export async function adminCreateManualPlayer(displayName: string, phone?: string): Promise<Player> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.rpc('admin_create_manual_player', {
    p_display_name: displayName,
    p_phone: phone ?? null,
  })
  if (error) throw error
  return data as Player
}

export async function fetchGames(): Promise<Game[]> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.from('games').select('*').order('game_number', { ascending: true })
  if (error) throw error
  return (data ?? []) as Game[]
}

export async function fetchCurrentGame(): Promise<Game | null> {
  const games = await fetchGames()
  return selectCurrentGame(games)
}

export async function adminCompleteGame(input: {
  gameId: string
  completionType: CompletionType
  winnerPlayerId?: string | null
  finalPot: number
  prizePaidAmount: number
  rolloverAmount: number
  notes?: string | null
  nonSurvivorReason?: string | null
}): Promise<{ result: string; game: Game }> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.rpc('admin_complete_game', {
    p_game_id: input.gameId,
    p_completion_type: input.completionType,
    p_winner_player_id: input.winnerPlayerId ?? null,
    p_final_pot: input.finalPot,
    p_prize_paid_amount: input.prizePaidAmount,
    p_rollover_amount: input.rolloverAmount,
    p_notes: input.notes ?? null,
    p_non_survivor_reason: input.nonSurvivorReason ?? null,
  })
  if (error) throw error
  return data as { result: string; game: Game }
}

export async function adminStartNewGame(input: {
  previousGameId: string
  gameNumber: number
  season?: string | null
  openingPot: number
  carryForwardPlayers: boolean
}): Promise<{ result: string; game: Game; entry_count?: number }> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.rpc('admin_start_new_game', {
    p_previous_game_id: input.previousGameId,
    p_game_number: input.gameNumber,
    p_season: input.season ?? null,
    p_opening_pot: input.openingPot,
    p_carry_forward_players: input.carryForwardPlayers,
    p_allow_standalone: false,
  })
  if (error) throw error
  return data as { result: string; game: Game; entry_count?: number }
}

export async function fetchMyGameEntry(playerId: string, gameId: string): Promise<GameEntry | null> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('game_entries')
    .select('*')
    .eq('game_id', gameId)
    .eq('player_id', playerId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export async function fetchOrCreateGameEntry(playerId: string, game: Game): Promise<GameEntry> {
  if (!isLiveGameStatus(game.status)) {
    throw new Error('This game is complete. Join the next game when it opens.')
  }

  const existing = await fetchMyGameEntry(playerId, game.id)
  if (existing) {
    return existing
  }

  const client = getSupabaseOrThrow()
  const entryType: EntryType = 'existing'
  const amountDue = calculateAmountDue(entryType, game, 1)

  const { data, error } = await client
    .from('game_entries')
    .insert({
      game_id: game.id,
      player_id: playerId,
      entry_type: entryType,
      amount_due: amountDue,
      entry_count: 1,
      fee_set_by_admin: false,
      payment_claimed: false,
      paid: false,
      status: 'pending_payment',
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function claimPayment(entryId: string): Promise<GameEntry> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('game_entries')
    .update({ payment_claimed: true })
    .eq('id', entryId)
    .eq('paid', false)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function adminFetchGameEntries(gameId: string): Promise<GameEntryWithPlayer[]> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('game_entries')
    .select(
      `
      *,
      player:players (
        display_name,
        phone,
        email,
        is_admin,
        is_manual
      )
    `,
    )
    .eq('game_id', gameId)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as GameEntryWithPlayer[]
}

export async function adminVerifyPayment(entryId: string): Promise<GameEntry> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('game_entries')
    .update({
      paid: true,
      paid_at: new Date().toISOString(),
      status: 'active',
    })
    .eq('id', entryId)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function adminSetEntryType(
  entryId: string,
  entryType: EntryType,
  game: Game,
): Promise<GameEntry> {
  const client = getSupabaseOrThrow()
  const amountDue = calculateAmountDue(entryType, game, 1)

  const { data, error } = await client
    .from('game_entries')
    .update({
      entry_type: entryType,
      amount_due: amountDue,
      fee_set_by_admin: true,
    })
    .eq('id', entryId)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}
