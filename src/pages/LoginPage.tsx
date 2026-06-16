import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/Card'
import { SupabaseConfigNotice } from '../components/SupabaseConfigNotice'
import { useAuth } from '../contexts/AuthContext'
import { getSupabaseConfigStatus } from '../lib/supabase'

export function LoginPage() {
  const navigate = useNavigate()
  const { configured, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(
    () => email.includes('@') && password.length >= 8 && !submitting,
    [email, password.length, submitting],
  )

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!configured) {
      setError('Supabase is not configured in this environment yet.')
      return
    }

    setSubmitting(true)

    try {
      await signIn({ email, password })
      navigate('/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.'
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
    <div className="mx-auto grid max-w-md gap-4">
      <Card title="Log in" description="Email/password login.">
        <form className="grid gap-3" onSubmit={onSubmit}>
          <label className="grid gap-1">
            <span className="text-sm font-bold text-ink">Email</span>
            <input
              className="los-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              disabled={submitting}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-bold text-ink">Password</span>
            <input
              className="los-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Your password"
              autoComplete="current-password"
              disabled={submitting}
            />
          </label>

          <button type="submit" disabled={!canSubmit} className="los-btn-primary mt-2 h-11 w-full">
            {submitting ? 'Logging in...' : 'Log in'}
          </button>

          {error ? <div className="los-alert los-alert-error">{error}</div> : null}
        </form>
      </Card>
    </div>
  )
}
