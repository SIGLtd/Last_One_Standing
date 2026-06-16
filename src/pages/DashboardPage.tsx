import { ButtonLink } from '../components/ButtonLink'
import { Card } from '../components/Card'
import { useAuth } from '../contexts/AuthContext'
import { CURRENT_GAME, CURRENT_POT_GBP, STATUS, formatGBP } from '../lib/constants'

export function DashboardPage() {
  const { user, player, loading } = useAuth()

  if (loading) {
    return (
      <div className="grid gap-4">
        <Card title="Dashboard" description="Loading your account...">
          <p className="text-sm text-muted">Please wait.</p>
        </Card>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="grid gap-4">
        <Card title="Dashboard" description="You are not logged in">
          <div className="grid gap-3">
            <p className="text-sm text-muted">Log in or create an account to view your player dashboard.</p>
            <div className="flex flex-wrap gap-2">
              <ButtonLink to="/login">Log in</ButtonLink>
              <ButtonLink to="/signup" variant="secondary">
                Sign up
              </ButtonLink>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const displayName = player?.display_name ?? user.user_metadata?.display_name ?? 'Player'
  const phone = player?.phone ?? 'Not set'
  const email = player?.email ?? user.email ?? 'Not set'

  return (
    <div className="grid gap-4">
      <Card title="Dashboard" description={`Game ${CURRENT_GAME} • Pot ${formatGBP(CURRENT_POT_GBP)}`}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="text-xs font-semibold text-muted">Display name</div>
            <div className="mt-1 text-sm font-semibold text-text">{displayName}</div>
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="text-xs font-semibold text-muted">Phone</div>
            <div className="mt-1 text-sm text-text">{phone}</div>
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="text-xs font-semibold text-muted">Email</div>
            <div className="mt-1 text-sm text-text">{email}</div>
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="text-xs font-semibold text-muted">Current game</div>
            <div className="mt-1 text-sm text-text">Game {CURRENT_GAME}</div>
            <div className="mt-2 text-xs font-semibold text-muted">Current pot</div>
            <div className="mt-1 text-sm text-text">{formatGBP(CURRENT_POT_GBP)}</div>
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="text-xs font-semibold text-muted">Payment status</div>
            <div className="mt-1 text-sm text-text">Placeholder — not verified yet</div>
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="text-xs font-semibold text-muted">Player status</div>
            <div className="mt-1 text-sm text-text">Placeholder — active</div>
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-3 md:col-span-2">
            <div className="text-xs font-semibold text-muted">Next action</div>
            <div className="mt-1 text-sm text-text">
              {STATUS.offSeason
                ? 'Wait for the next selection window.'
                : 'Make or update your pick when the window opens.'}
            </div>
          </div>
        </div>

        {!player ? (
          <div className="mt-4 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
            Your auth account is active, but no linked player profile was found yet.
          </div>
        ) : null}
      </Card>
    </div>
  )
}
