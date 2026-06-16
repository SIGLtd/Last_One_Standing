import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function getValidSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

  if (!url || !anonKey) {
    return null
  }

  if (!/^https?:\/\//i.test(url)) {
    return null
  }

  try {
    new URL(url)
  } catch {
    return null
  }

  // Basic sanity check — real Supabase anon keys are JWT-length strings.
  if (anonKey.length < 20) {
    return null
  }

  return { url, anonKey }
}

function createSupabaseClient(): SupabaseClient | null {
  const config = getValidSupabaseConfig()
  if (!config) {
    return null
  }

  try {
    return createClient(config.url, config.anonKey)
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error)
    return null
  }
}

export const supabase = createSupabaseClient()

export const isSupabaseConfigured = supabase !== null

export function getSupabaseOrThrow() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.',
    )
  }
  return supabase
}
