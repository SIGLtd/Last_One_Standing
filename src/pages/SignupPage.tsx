import { useMemo, useState } from 'react'
import { Card } from '../components/Card'
import { supabase } from '../lib/supabase'

export function SignupPage() {
  const supabaseReady = Boolean(supabase)
  const [displayName, setDisplayName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<{ type: 'idle' | 'error' | 'success'; message?: string }>({ type: 'idle' })

  const canSubmit = useMemo(() => {
    return displayName.trim().length > 1 && phoneNumber.trim().length > 5 && email.includes('@') && password.length >= 8
  }, [displayName, email, password.length, phoneNumber])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus({ type: 'idle' })

    if (!supabaseReady) {
      setStatus({
        type: 'error',
        message: 'Supabase is not configured in this environment yet.',
      })
      return
    }

    const { error } = await supabase!.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          phone_number: phoneNumber,
        },
      },
    })

    if (error) {
      setStatus({ type: 'error', message: error.message })
      return
    }

    setStatus({
      type: 'success',
      message: 'Account created. Check your email if confirmation is enabled.',
    })
  }

  return (
    <div className="grid gap-4">
      <Card
        title="Sign up"
        description="Email/password MVP. Phone number is required for the WhatsApp group."
        right={
          <span className="text-xs font-semibold text-muted">
            {supabaseReady ? 'Supabase ready' : 'Supabase not configured'}
          </span>
        }
      >
        <form className="grid gap-3" onSubmit={onSubmit}>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Display name</span>
            <input
              className="h-11 rounded-xl border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-accent"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Ben"
              autoComplete="nickname"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold">Phone number</span>
            <input
              className="h-11 rounded-xl border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-accent"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. +44..."
              autoComplete="tel"
            />
          </label>

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
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
            />
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 h-11 rounded-xl border border-accent bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-50"
          >
            Create account
          </button>

          {status.type !== 'idle' ? (
            <div
              className={[
                'rounded-xl border px-3 py-2 text-sm',
                status.type === 'success'
                  ? 'border-success/40 bg-success/10 text-text'
                  : 'border-border bg-surface-2 text-text',
              ].join(' ')}
            >
              {status.message}
            </div>
          ) : null}

          <div className="text-xs text-muted">
            This milestone only scaffolds auth. Player profiles and payments will be stored in the database schema.
          </div>
        </form>
      </Card>
    </div>
  )
}

