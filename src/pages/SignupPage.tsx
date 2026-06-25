import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/Card'
import { AppLogo } from '../components/AppLogo'
import { PreLaunchNotice } from '../components/PreLaunchNotice'
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
    <div className="mx-auto grid max-w-sm gap-2">
      <div className="flex justify-center py-1">
        <AppLogo losClassName="h-8 w-8" plClassName="h-6 w-auto max-w-[8rem]" />
      </div>
      <Card title="Sign up" description="Phone required for WhatsApp group" compact>
        <PreLaunchNotice title="Before you join" className="mb-3" />
        <form className="grid gap-2" onSubmit={onSubmit}>
          <label className="grid gap-0.5">
            <span className="los-section-title">Display name</span>
            <input
              className="los-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Ben"
              autoComplete="nickname"
              disabled={submitting}
            />
          </label>

          <label className="grid gap-0.5">
            <span className="los-section-title">Phone</span>
            <input
              className="los-input"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. +44..."
              autoComplete="tel"
              disabled={submitting}
            />
          </label>

          <label className="grid gap-0.5">
            <span className="los-section-title">Email</span>
            <input
              className="los-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              disabled={submitting}
            />
          </label>

          <label className="grid gap-0.5">
            <span className="los-section-title">Password</span>
            <input
              className="los-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
              disabled={submitting}
            />
          </label>

          <button type="submit" disabled={!canSubmit} className="los-btn-primary mt-2 h-11 w-full">
            {submitting ? 'Creating account...' : 'Create account'}
          </button>

          {error ? <div className="los-alert los-alert-error">{error}</div> : null}
        </form>
      </Card>
    </div>
  )
}
