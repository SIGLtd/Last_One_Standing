import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type SupabaseConfigIssue =
  | 'missing_url'
  | 'invalid_url'
  | 'missing_key'
  | 'invalid_key'
  | 'client_init_failed'

type KeyVarName = 'VITE_SUPABASE_ANON_KEY' | 'VITE_SUPABASE_PUBLISHABLE_KEY' | null

export type SupabaseConfigStatus =
  | { ok: true }
  | {
      ok: false
      issues: SupabaseConfigIssue[]
      url?: string
      maskedKey?: string
      usedKeyVar: KeyVarName
    }

function readEnv(name: string): string {
  return (import.meta.env[name] as string | undefined)?.trim() ?? ''
}

function readSupabaseUrl(): string {
  return readEnv('VITE_SUPABASE_URL')
}

function readSupabaseKey(): { key: string; varName: KeyVarName } {
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY')
  if (anonKey) {
    return { key: anonKey, varName: 'VITE_SUPABASE_ANON_KEY' }
  }

  const publishableKey = readEnv('VITE_SUPABASE_PUBLISHABLE_KEY')
  if (publishableKey) {
    return { key: publishableKey, varName: 'VITE_SUPABASE_PUBLISHABLE_KEY' }
  }

  return { key: '', varName: null }
}

export function maskSecret(value: string): string {
  if (value.length <= 8) {
    return '••••••••'
  }

  return `${value.slice(0, 12)}…${value.slice(-4)}`
}

function isValidSupabaseUrl(url: string): boolean {
  if (!url) {
    return false
  }

  if (!/^https?:\/\//i.test(url)) {
    return false
  }

  // Catch common typo: https:https://project.supabase.co
  if (/^https?:\/\/https?:/i.test(url)) {
    return false
  }

  try {
    const parsed = new URL(url)
    return Boolean(parsed.hostname && parsed.hostname.includes('.'))
  } catch {
    return false
  }
}

function isValidSupabaseKey(key: string): boolean {
  if (!key) {
    return false
  }

  // Legacy JWT anon key
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) {
    return true
  }

  // New Supabase publishable key format
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) && key.length >= 20) {
    return true
  }

  return false
}

function validateSupabaseEnv():
  | { ok: true; url: string; anonKey: string; varName: KeyVarName }
  | { ok: false; issues: SupabaseConfigIssue[]; url?: string; maskedKey?: string; varName: KeyVarName } {
  const url = readSupabaseUrl()
  const { key, varName } = readSupabaseKey()
  const issues: SupabaseConfigIssue[] = []

  if (!url) {
    issues.push('missing_url')
  } else if (!isValidSupabaseUrl(url)) {
    issues.push('invalid_url')
  }

  if (!key) {
    issues.push('missing_key')
  } else if (!isValidSupabaseKey(key)) {
    issues.push('invalid_key')
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues,
      url: url || undefined,
      maskedKey: key ? maskSecret(key) : undefined,
      varName,
    }
  }

  return { ok: true, url, anonKey: key, varName }
}

function createSupabaseClient(): SupabaseClient | null {
  const validation = validateSupabaseEnv()
  if (!validation.ok) {
    return null
  }

  try {
    return createClient(validation.url, validation.anonKey)
  } catch {
    console.error('Failed to initialize Supabase client')
    return null
  }
}

export const supabase = createSupabaseClient()

export const isSupabaseConfigured = supabase !== null

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const validation = validateSupabaseEnv()

  if (!validation.ok) {
    return {
      ok: false,
      issues: validation.issues,
      url: validation.url,
      maskedKey: validation.maskedKey,
      usedKeyVar: validation.varName,
    }
  }

  if (!supabase) {
    return {
      ok: false,
      issues: ['client_init_failed'],
      url: validation.url,
      maskedKey: maskSecret(validation.anonKey),
      usedKeyVar: validation.varName,
    }
  }

  return { ok: true }
}

export function getSupabaseOrThrow() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.',
    )
  }
  return supabase
}
