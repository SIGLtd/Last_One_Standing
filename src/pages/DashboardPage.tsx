import { useCallback, useEffect, useState } from 'react'
import { ButtonLink } from '../components/ButtonLink'
import { Card } from '../components/Card'
import { PaymentStatusCard } from '../components/PaymentStatusCard'
import { useAuth } from '../contexts/AuthContext'
import {
  claimPayment,
  fetchCurrentGame,
  fetchMyGameEntry,
  fetchOrCreateGameEntry,
} from '../lib/gameEntries'
import { formatGBP } from '../lib/constants'
import type { Game, GameEntry } from '../types'

export function DashboardPage() {
  const { user, player, loading } = useAuth()
  const [game, setGame] = useState<Game | null>(null)
  const [entry, setEntry] = useState<GameEntry | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [creating, setCreating] = useState(false)

  const loadDashboard = useCallback(async () => {
    if (!player) {
      setGame(null)
      setEntry(null)
      setPageLoading(false)
      return
    }

    setPageLoading(true)
    setPageError(null)

    try {
      const currentGame = await fetchCurrentGame()
      setGame(currentGame)

      if (currentGame) {
        const myEntry = await fetchMyGameEntry(player.id, currentGame.id)
        setEntry(myEntry)
      } else {
        setEntry(null)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data.'
      setPageError(message)
    } finally {
      setPageLoading(false)
    }
  }, [player])

  useEffect(() => {
    if (!loading) {
      void loadDashboard()
    }
  }, [loading, loadDashboard])

  async function handleCreateEntry() {
    if (!player || !game) return

    setCreating(true)
    setPageError(null)

    try {
      const newEntry = await fetchOrCreateGameEntry(player.id, game)
      setEntry(newEntry)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create entry.'
      setPageError(message)
    } finally {
      setCreating(false)
    }
  }

  async function handleClaimPayment() {
    if (!entry) return

    setClaiming(true)
    setPageError(null)

    try {
      const updated = await claimPayment(entry.id)
      setEntry(updated)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark payment as sent.'
      setPageError(message)
    } finally {
      setClaiming(false)
    }
  }

  if (loading || pageLoading) {
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
      <Card
        title="Dashboard"
        description={
          game
            ? `Game ${game.game_number} • Pot ${formatGBP(game.current_pot)}`
            : 'Game 27 entry and payment'
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-3">
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
          </div>

          {!player ? (
            <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
              Your auth account is active, but no linked player profile was found yet.
            </div>
          ) : null}

          {pageError ? (
            <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text">
              {pageError}
            </div>
          ) : null}

          {!game ? (
            <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
              Game 27 has not been seeded in the database yet. Ask an admin to run the Supabase seed SQL.
            </div>
          ) : player ? (
            <PaymentStatusCard
              game={game}
              entry={entry}
              claiming={claiming}
              creating={creating}
              onClaimPayment={entry ? () => void handleClaimPayment() : undefined}
              onCreateEntry={() => void handleCreateEntry()}
            />
          ) : null}
        </div>
      </Card>
    </div>
  )
}
