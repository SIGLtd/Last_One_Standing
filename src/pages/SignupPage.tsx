import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/Card'
import { SupabaseConfigNotice } from '../components/SupabaseConfigNotice'
import { useAuth } from '../contexts/AuthContext'
import { getSupabaseConfigStatus } from '../lib/supabase'

export function SignupPage() {
  const navigate = useNavigate()
  const { configured, signUp } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    return (
      displayName.trim().length > 1 &&
      phoneNumber.trim().length > 5 &&
      email.includes('@') &&
      password.length >= 8 &&
      !submitting
    )
  }, [displayName, email, password.length, phoneNumber, submitting])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!configured) {
      setError('Supabase is not configured in this environment yet.')
      return
    }

    setSubmitting(true)

    try {
      await signUp({
        displayName,
        phone: phoneNumber,
        email,
        password,
      })
      navigate('/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed. Please try again.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!configured) {
    return (
      <div className="grid gap-4">
        <SupabaseConfigNotice status={getSupabaseConfigStatus()} />
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <Card
        title="Sign up"
        description="Email/password MVP. Phone number is required for the WhatsApp group."
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
              disabled={submitting}
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
              disabled={submitting}
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
              disabled={submitting}
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
              disabled={submitting}
            />
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 h-11 rounded-xl border border-accent bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-50"
          >
            {submitting ? 'Creating account...' : 'Create account'}
          </button>

          {error ? (
            <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text">
              {error}
            </div>
          ) : null}
        </form>
      </Card>
    </div>
  )
}
