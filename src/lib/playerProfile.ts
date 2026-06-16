import type { Player } from '../types'
import { getSupabaseOrThrow } from './supabase'

export async function fetchPlayerProfile(userId: string): Promise<Player | null> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.from('players').select('*').eq('user_id', userId).maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export type UpsertPlayerProfileInput = {
  userId: string
  displayName: string
  phone: string
  email: string
}

export async function upsertPlayerProfile(input: UpsertPlayerProfileInput): Promise<Player> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('players')
    .upsert(
      {
        user_id: input.userId,
        display_name: input.displayName.trim(),
        phone: input.phone.trim(),
        email: input.email.trim(),
        is_admin: false,
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}
