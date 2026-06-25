import { useCallback, useEffect, useState } from 'react'
import { ButtonLink } from '../components/ButtonLink'
import { Card } from '../components/Card'
import { MetricCell, MetricStrip } from '../components/MetricCell'
import { PaymentStatusCard } from '../components/PaymentStatusCard'
import { useAuth } from '../contexts/AuthContext'
import {
  claimPayment,
  fetchCurrentGame,
  fetchMyGameEntry,
  fetchOrCreateGameEntry,
} from '../lib/gameEntries'
import { formatGBP } from '../lib/constants'
import { fetchOpenSelectionWindow } from '../lib/fixtureOps'
import {
  CURRENT_PICKS_ROUND_OPEN_INTRO,
  PLAYER_COMPLETE_ENTRY_MESSAGE,
  PLAYER_ROUND1_OPEN_MESSAGE,
  derivePlayerEntryState,
} from '../lib/round1'
import type { Game, GameEntry, SelectionWindowWithMeta } from '../types'

export function DashboardPage() {
  const { user, player, loading } = useAuth()
  const [game, setGame] = useState<Game | null>(null)
  const [entry, setEntry] = useState<GameEntry | null>(null)
  const [openWindow, setOpenWindow] = useState<SelectionWindowWithMeta | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [creating, setCreating] = useState(false)

  const loadDashboard = useCallback(async () => {
    if (!player) {
      setGame(null)
      setEntry(null)
      setOpenWindow(null)
      setPageLoading(false)
      return
    }

    setPageLoading(true)
    setPageError(null)

    try {
      const currentGame = await fetchCurrentGame()
      setGame(currentGame)

      if (currentGame) {
        const [myEntry, liveWindow] = await Promise.all([
          fetchMyGameEntry(player.id, currentGame.id),
          fetchOpenSelectionWindow(currentGame.id),
        ])
        setEntry(myEntry)
        setOpenWindow(liveWindow)
      } else {
        setEntry(null)
        setOpenWindow(null)
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
      <Card title="Dashboard" description="Loading…" compact>
        <p className="text-xs text-muted-ink">Please wait.</p>
      </Card>
    )
  }

  if (!user) {
    return (
      <Card title="Dashboard" description="Not signed in" compact>
        <p className="text-xs text-muted-ink mb-3">Log in or create an account to view your dashboard.</p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/login">Log in</ButtonLink>
          <ButtonLink to="/signup" variant="secondary">
            Sign up
          </ButtonLink>
        </div>
      </Card>
    )
  }

  const displayName = player?.display_name ?? user.user_metadata?.display_name ?? 'Player'
  const paymentLabel = entry?.paid ? 'Verified' : entry?.payment_claimed ? 'Pending verify' : entry ? 'Unpaid' : 'No entry'
  const entryStatus = entry?.status ?? '—'
  const roundIsOpen = Boolean(openWindow)
  const entryState = derivePlayerEntryState(entry, roundIsOpen)

  return (
    <div className="grid gap-3">
      <Card
        title="Dashboard"
        description={game ? `Game ${game.game_number}` : 'Game 27'}
        compact
      >
        <div className="grid gap-3">
          {game ? (
            <MetricStrip>
              <MetricCell label="Game" value={game.game_number} />
              <MetricCell label="Pot" value={formatGBP(game.current_pot)} />
              <MetricCell label="Player" value={displayName} />
              <MetricCell label="Payment" value={paymentLabel} />
              <MetricCell label="Status" value={entryStatus} />
            </MetricStrip>
          ) : (
            <div className="los-notice text-xs">Game 27 not seeded. Ask an admin to run the Supabase seed SQL.</div>
          )}

          <div className="los-divider-list">
            <div className="los-divider-row flex justify-between gap-2">
              <span className="text-muted-ink">Phone</span>
              <span className="text-ink">{player?.phone ?? 'Not set'}</span>
            </div>
            <div className="los-divider-row flex justify-between gap-2">
              <span className="text-muted-ink">Email</span>
              <span className="text-ink truncate">{player?.email ?? user.email ?? 'Not set'}</span>
            </div>
          </div>

          {!player ? (
            <div className="los-alert los-alert-error">Auth active but no linked player profile found.</div>
          ) : null}

          {pageError ? (
            <div className="los-alert los-alert-error">
              {pageError}
              <button type="button" onClick={() => void loadDashboard()} className="ml-2 underline">
                Retry
              </button>
            </div>
          ) : null}

          {entryState === 'no_entry' || entryState === 'awaiting_payment' || entryState === 'awaiting_verification' ? (
            <div className="los-notice text-xs">{PLAYER_COMPLETE_ENTRY_MESSAGE}</div>
          ) : null}

          {entryState === 'entered_can_pick' && roundIsOpen ? (
            <div className="grid gap-2">
              <div className="los-alert los-alert-success text-xs">{PLAYER_ROUND1_OPEN_MESSAGE}</div>
              <div className="flex flex-wrap gap-2">
                <ButtonLink to="/pick">Make your pick</ButtonLink>
                <ButtonLink to="/current-picks" variant="secondary">
                  Current picks
                </ButtonLink>
                <ButtonLink to="/rules" variant="secondary">
                  Rules
                </ButtonLink>
              </div>
              <p className="text-xs text-muted-ink">{CURRENT_PICKS_ROUND_OPEN_INTRO}</p>
            </div>
          ) : null}

          {game && player ? (
            <PaymentStatusCard
              game={game}
              entry={entry}
              roundIsOpen={roundIsOpen}
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
