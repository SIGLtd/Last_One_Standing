import { CURRENT_GAME } from './constants'
import { getSupabaseOrThrow } from './supabase'
import type { EntryType, Game, GameEntry, GameEntryWithPlayer } from '../types'

export function getAmountDue(entryType: EntryType, game: Game): number {
  switch (entryType) {
    case 'existing':
      return game.standard_entry_fee
    case 'newbie':
      return game.newbie_entry_fee
    case 'admin_comp':
      return 0
  }
}

export async function fetchCurrentGame(): Promise<Game | null> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('games')
    .select('*')
    .eq('game_number', CURRENT_GAME)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
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
  const existing = await fetchMyGameEntry(playerId, game.id)
  if (existing) {
    return existing
  }

  const client = getSupabaseOrThrow()
  const entryType: EntryType = 'newbie'
  const amountDue = getAmountDue(entryType, game)

  const { data, error } = await client
    .from('game_entries')
    .insert({
      game_id: game.id,
      player_id: playerId,
      entry_type: entryType,
      amount_due: amountDue,
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
        email
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
  const amountDue = getAmountDue(entryType, game)

  const { data, error } = await client
    .from('game_entries')
    .update({
      entry_type: entryType,
      amount_due: amountDue,
    })
    .eq('id', entryId)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}
