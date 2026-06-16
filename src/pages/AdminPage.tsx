import { useCallback, useEffect, useState } from 'react'
import { ButtonLink } from '../components/ButtonLink'
import { Card } from '../components/Card'
import { useAuth } from '../contexts/AuthContext'
import {
  adminFetchGameEntries,
  adminSetEntryType,
  adminVerifyPayment,
  fetchCurrentGame,
} from '../lib/gameEntries'
import { formatGBP } from '../lib/constants'
import type { EntryType, Game, GameEntryWithPlayer } from '../types'

const placeholderSections = [
  { title: 'Selection window', body: 'Placeholder for opening/locking windows and deadlines.' },
  { title: 'Manual selection correction', body: 'Placeholder for correcting picks before/after lock with audit trail.' },
  { title: 'Result resolution', body: 'Placeholder for manual resolution until automation is added.' },
  { title: 'Historical results management', body: 'Placeholder for editing seeded history data.' },
  { title: 'WhatsApp report generator', body: 'Placeholder. No WhatsApp integration in this milestone.' },
] as const

function formatEntryType(entryType: EntryType) {
  switch (entryType) {
    case 'existing':
      return 'Returning'
    case 'newbie':
      return 'Newbie'
    case 'admin_comp':
      return 'Admin comp'
  }
}

export function AdminPage() {
  const { user, player, loading } = useAuth()
  const [game, setGame] = useState<Game | null>(null)
  const [entries, setEntries] = useState<GameEntryWithPlayer[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const loadAdminData = useCallback(async () => {
    if (!player?.is_admin) {
      setPageLoading(false)
      return
    }

    setPageLoading(true)
    setPageError(null)

    try {
      const currentGame = await fetchCurrentGame()
      setGame(currentGame)

      if (currentGame) {
        const gameEntries = await adminFetchGameEntries(currentGame.id)
        setEntries(gameEntries)
      } else {
        setEntries([])
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load admin data.'
      setPageError(message)
    } finally {
      setPageLoading(false)
    }
  }, [player?.is_admin])

  useEffect(() => {
    if (!loading) {
      void loadAdminData()
    }
  }, [loading, loadAdminData])

  async function handleVerifyPayment(entryId: string) {
    if (!game) return

    setActionId(entryId)
    setPageError(null)

    try {
      await adminVerifyPayment(entryId)
      const gameEntries = await adminFetchGameEntries(game.id)
      setEntries(gameEntries)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to verify payment.'
      setPageError(message)
    } finally {
      setActionId(null)
    }
  }

  async function handleSetEntryType(entryId: string, entryType: EntryType) {
    if (!game) return

    setActionId(entryId)
    setPageError(null)

    try {
      await adminSetEntryType(entryId, entryType, game)
      const gameEntries = await adminFetchGameEntries(game.id)
      setEntries(gameEntries)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update entry type.'
      setPageError(message)
    } finally {
      setActionId(null)
    }
  }

  if (loading || pageLoading) {
    return (
      <div className="grid gap-4">
        <Card title="Admin" description="Loading...">
          <p className="text-sm text-muted">Please wait.</p>
        </Card>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="grid gap-4">
        <Card title="Admin" description="Login required">
          <div className="grid gap-3">
            <p className="text-sm text-muted">Log in with an admin account to access admin controls.</p>
            <ButtonLink to="/login">Log in</ButtonLink>
          </div>
        </Card>
      </div>
    )
  }

  if (!player?.is_admin) {
    return (
      <div className="grid gap-4">
        <Card title="Admin" description="Access denied">
          <p className="text-sm text-muted">You do not have admin access.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <Card
        title="Admin"
        description="Payment verification and entry management"
        right={
          <span className="inline-flex items-center rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">
            Admin
          </span>
        }
      >
        {pageError ? (
          <div className="mb-4 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text">
            {pageError}
          </div>
        ) : null}

        <div className="grid gap-4">
          <section className="rounded-xl border border-border bg-surface-2 p-3">
            <h2 className="text-sm font-semibold text-text">Current game summary</h2>
            {game ? (
              <div className="mt-2 grid gap-1 text-sm text-muted">
                <div>Game {game.game_number} • {game.season}</div>
                <div>Status: {game.status}</div>
                <div>Pot: {formatGBP(game.current_pot)}</div>
                <div>Returning fee: {formatGBP(game.standard_entry_fee)}</div>
                <div>Newbie fee: {formatGBP(game.newbie_entry_fee)}</div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Game 27 not found. Run the seed SQL in Supabase.</p>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-text">Payments</h2>
            <p className="mb-3 text-xs text-muted">
              Admin controls are UI-gated by player.is_admin. RLS admin policies must also be applied in Supabase.
            </p>

            {game ? (
              <div className="overflow-x-auto">
                <table className="min-w-[960px] w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-muted">
                      <th className="border-b border-border px-3 py-3">Player</th>
                      <th className="border-b border-border px-3 py-3">Phone</th>
                      <th className="border-b border-border px-3 py-3">Email</th>
                      <th className="border-b border-border px-3 py-3">Entry type</th>
                      <th className="border-b border-border px-3 py-3">Amount due</th>
                      <th className="border-b border-border px-3 py-3">Claimed</th>
                      <th className="border-b border-border px-3 py-3">Paid</th>
                      <th className="border-b border-border px-3 py-3">Paid at</th>
                      <th className="border-b border-border px-3 py-3">Status</th>
                      <th className="border-b border-border px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-4 text-sm text-muted">
                          No entries yet.
                        </td>
                      </tr>
                    ) : (
                      entries.map((row) => {
                        const busy = actionId === row.id
                        return (
                          <tr key={row.id} className="text-sm">
                            <td className="border-b border-border/70 px-3 py-3 font-semibold">
                              {row.player.display_name}
                            </td>
                            <td className="border-b border-border/70 px-3 py-3 text-muted">
                              {row.player.phone ?? '—'}
                            </td>
                            <td className="border-b border-border/70 px-3 py-3 text-muted">{row.player.email}</td>
                            <td className="border-b border-border/70 px-3 py-3 text-muted">
                              {formatEntryType(row.entry_type)}
                            </td>
                            <td className="border-b border-border/70 px-3 py-3 text-muted">
                              {formatGBP(row.amount_due)}
                            </td>
                            <td className="border-b border-border/70 px-3 py-3 text-muted">
                              {row.payment_claimed ? 'Yes' : 'No'}
                            </td>
                            <td className="border-b border-border/70 px-3 py-3 text-muted">
                              {row.paid ? 'Yes' : 'No'}
                            </td>
                            <td className="border-b border-border/70 px-3 py-3 text-muted">
                              {row.paid_at ? new Date(row.paid_at).toLocaleString('en-GB') : '—'}
                            </td>
                            <td className="border-b border-border/70 px-3 py-3 text-muted">{row.status}</td>
                            <td className="border-b border-border/70 px-3 py-3">
                              <div className="flex flex-wrap gap-1">
                                {!row.paid ? (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void handleVerifyPayment(row.id)}
                                    className="rounded-lg border border-border bg-surface px-2 py-1 text-xs hover:bg-surface-2 disabled:opacity-50"
                                  >
                                    Verify
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleSetEntryType(row.id, 'existing')}
                                  className="rounded-lg border border-border bg-surface px-2 py-1 text-xs hover:bg-surface-2 disabled:opacity-50"
                                >
                                  Existing
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleSetEntryType(row.id, 'newbie')}
                                  className="rounded-lg border border-border bg-surface px-2 py-1 text-xs hover:bg-surface-2 disabled:opacity-50"
                                >
                                  Newbie
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleSetEntryType(row.id, 'admin_comp')}
                                  className="rounded-lg border border-border bg-surface px-2 py-1 text-xs hover:bg-surface-2 disabled:opacity-50"
                                >
                                  Comp
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            {placeholderSections.map((s) => (
              <div key={s.title} className="rounded-xl border border-border bg-surface-2 p-3">
                <div className="text-sm font-semibold text-text">{s.title}</div>
                <div className="mt-1 text-sm text-muted">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
