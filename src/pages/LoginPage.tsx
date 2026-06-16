import { useMemo, useState } from 'react'
import { Card } from '../components/Card'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const supabaseReady = Boolean(supabase)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<{ type: 'idle' | 'error' | 'success'; message?: string }>({ type: 'idle' })

  const canSubmit = useMemo(() => email.includes('@') && password.length >= 8, [email, password.length])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus({ type: 'idle' })

    if (!supabaseReady) {
      setStatus({ type: 'error', message: 'Supabase is not configured in this environment yet.' })
      return
    }

    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    if (error) {
      setStatus({ type: 'error', message: error.message })
      return
    }

    setStatus({ type: 'success', message: 'Logged in.' })
  }

  return (
    <div className="grid gap-4">
      <Card
        title="Log in"
        description="Email/password login scaffold."
        right={<span className="text-xs font-semibold text-muted">{supabaseReady ? 'Supabase ready' : 'Supabase not configured'}</span>}
      >
        <form className="grid gap-3" onSubmit={onSubmit}>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Email</span>
            <input
              className="h-11 rounded-xl border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-accent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold">Password</span>
            <input
              className="h-11 rounded-xl border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-accent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Your password"
              autoComplete="current-password"
            />
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 h-11 rounded-xl border border-accent bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-50"
          >
            Log in
          </button>

          {status.type !== 'idle' ? (
            <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text">
              {status.message}
            </div>
          ) : null}
        </form>
      </Card>
    </div>
  )
}

