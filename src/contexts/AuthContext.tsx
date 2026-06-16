import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { fetchPlayerProfile, upsertPlayerProfile } from '../lib/playerProfile'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Player } from '../types'

export type SignUpInput = {
  displayName: string
  phone: string
  email: string
  password: string
}

export type SignInInput = {
  email: string
  password: string
}

type AuthContextValue = {
  session: Session | null
  user: User | null
  player: Player | null
  loading: boolean
  configured: boolean
  signUp: (input: SignUpInput) => Promise<void>
  signIn: (input: SignInInput) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  const loadPlayer = useCallback(async (authUser: User) => {
    if (!supabase) {
      setPlayer(null)
      return
    }

    try {
      let profile = await fetchPlayerProfile(authUser.id)

      if (!profile && authUser.email) {
        const displayName = (authUser.user_metadata?.display_name as string | undefined)?.trim()
        const phone = (authUser.user_metadata?.phone as string | undefined)?.trim() ?? ''

        if (displayName) {
          profile = await upsertPlayerProfile({
            userId: authUser.id,
            displayName,
            phone,
            email: authUser.email,
          })
        }
      }

      setPlayer(profile)
    } catch (profileError) {
      console.error('Failed to load player profile', profileError)
      setPlayer(null)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setPlayer(null)
      return
    }

    await loadPlayer(user)
  }, [loadPlayer, user])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    const client = supabase
    let active = true

    async function init() {
      try {
        const { data, error } = await client.auth.getSession()
        if (!active) return

        if (error) {
          console.error('Failed to load session', error)
          setSession(null)
          setUser(null)
          setPlayer(null)
          return
        }

        const nextSession = data.session
        setSession(nextSession)
        setUser(nextSession?.user ?? null)

        if (nextSession?.user) {
          await loadPlayer(nextSession.user)
        } else {
          setPlayer(null)
        }
      } catch (sessionError) {
        console.error('Failed to initialize auth session', sessionError)
        if (active) {
          setSession(null)
          setUser(null)
          setPlayer(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void init()

    let subscription: { unsubscribe: () => void } | null = null

    try {
      const {
        data: { subscription: authSubscription },
      } = client.auth.onAuthStateChange(async (_event, nextSession) => {
        if (!active) return

        setSession(nextSession)
        setUser(nextSession?.user ?? null)

        if (nextSession?.user) {
          await loadPlayer(nextSession.user)
        } else {
          setPlayer(null)
        }

        setLoading(false)
      })

      subscription = authSubscription
    } catch (listenerError) {
      console.error('Failed to set up auth listener', listenerError)
      setLoading(false)
    }

    return () => {
      active = false
      subscription?.unsubscribe()
    }
  }, [loadPlayer])

  const signUp = useCallback(
    async (input: SignUpInput) => {
      const client = supabase
      if (!client) {
        throw new Error('Supabase is not configured.')
      }

      const { data, error } = await client.auth.signUp({
        email: input.email.trim(),
        password: input.password,
        options: {
          data: {
            display_name: input.displayName.trim(),
            phone: input.phone.trim(),
          },
        },
      })

      if (error) {
        throw error
      }

      if (!data.user) {
        throw new Error('Sign up failed. No user was returned.')
      }

      if (!data.session) {
        throw new Error(
          'Account created. Confirm your email, then log in to complete your profile setup.',
        )
      }

      const profile = await upsertPlayerProfile({
        userId: data.user.id,
        displayName: input.displayName,
        phone: input.phone,
        email: input.email,
      })

      setSession(data.session)
      setUser(data.user)
      setPlayer(profile)
    },
    [],
  )

  const signIn = useCallback(async (input: SignInInput) => {
    const client = supabase
    if (!client) {
      throw new Error('Supabase is not configured.')
    }

    const { data, error } = await client.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    })

    if (error) {
      throw error
    }

    setSession(data.session)
    setUser(data.user)

    if (data.user) {
      await loadPlayer(data.user)
    }
  }, [loadPlayer])

  const signOut = useCallback(async () => {
    if (!supabase) {
      setSession(null)
      setUser(null)
      setPlayer(null)
      return
    }

    const { error } = await supabase.auth.signOut()
    if (error) {
      throw error
    }

    setSession(null)
    setUser(null)
    setPlayer(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      player,
      loading,
      configured: isSupabaseConfigured,
      signUp,
      signIn,
      signOut,
      refreshProfile,
    }),
    [session, user, player, loading, signUp, signIn, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
