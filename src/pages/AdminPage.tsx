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
import {
  adminCreateSelectionWindow,
  adminFetchSelectionWindows,
  adminLockSelectionWindow,
  adminUpdateSelectionWindow,
} from '../lib/selections'
import { formatGBP } from '../lib/constants'
import type { EntryType, Game, GameEntryWithPlayer, SelectionWindow, SelectionWindowStatus } from '../types'

const placeholderSections = [
  { title: 'Manual selection correction', body: 'Placeholder for correcting picks before/after lock with audit trail.' },
  { title: 'Result resolution', body: 'Placeholder for manual resolution until automation is added.' },
  { title: 'Historical results management', body: 'Placeholder for editing seeded history data.' },
  { title: 'WhatsApp report generator', body: 'Placeholder. No WhatsApp integration in this milestone.' },
] as const

const windowStatuses: SelectionWindowStatus[] = ['pending', 'open', 'locked', 'resolving', 'resolved']

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

function toDateTimeLocalValue(iso: string) {
  const date = new Date(iso)
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function defaultWindowForm(windowNumber: number) {
  const start = new Date()
  const end = new Date(start.getTime() + 48 * 60 * 60 * 1000)
  const deadline = new Date(start.getTime() + 24 * 60 * 60 * 1000)

  return {
    window_number: windowNumber,
    start_at: toDateTimeLocalValue(start.toISOString()),
    end_at: toDateTimeLocalValue(end.toISOString()),
    deadline_at: toDateTimeLocalValue(deadline.toISOString()),
    status: 'open' as SelectionWindowStatus,
  }
}

export function AdminPage() {
  const { user, player, loading } = useAuth()
  const [game, setGame] = useState<Game | null>(null)
  const [entries, setEntries] = useState<GameEntryWithPlayer[]>([])
  const [windows, setWindows] = useState<SelectionWindow[]>([])
  const [windowForm, setWindowForm] = useState(defaultWindowForm(1))
  const [editingWindowId, setEditingWindowId] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [windowSaving, setWindowSaving] = useState(false)

  const currentWindow = windows[0] ?? null

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
        const [gameEntries, gameWindows] = await Promise.all([
          adminFetchGameEntries(currentGame.id),
          adminFetchSelectionWindows(currentGame.id),
        ])
        setEntries(gameEntries)
        setWindows(gameWindows)

        const latest = gameWindows[0]
        if (latest) {
          setEditingWindowId(latest.id)
          setWindowForm({
            window_number: latest.window_number,
            start_at: toDateTimeLocalValue(latest.start_at),
            end_at: toDateTimeLocalValue(latest.end_at),
            deadline_at: toDateTimeLocalValue(latest.deadline_at),
            status: latest.status,
          })
        } else {
          setEditingWindowId(null)
          setWindowForm(defaultWindowForm(1))
        }
      } else {
        setEntries([])
        setWindows([])
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
      await loadAdminData()
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
      await loadAdminData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update entry type.'
      setPageError(message)
    } finally {
      setActionId(null)
    }
  }

  async function handleSaveWindow() {
    if (!game) return

    setWindowSaving(true)
    setPageError(null)

    const payload = {
      window_number: windowForm.window_number,
      start_at: new Date(windowForm.start_at).toISOString(),
      end_at: new Date(windowForm.end_at).toISOString(),
      deadline_at: new Date(windowForm.deadline_at).toISOString(),
      status: windowForm.status,
    }

    try {
      if (editingWindowId) {
        await adminUpdateSelectionWindow(editingWindowId, payload)
      } else {
        await adminCreateSelectionWindow(game.id, payload)
      }

      await loadAdminData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save selection window.'
      setPageError(message)
    } finally {
      setWindowSaving(false)
    }
  }

  async function handleCreateNewWindow() {
    const nextNumber = (windows[0]?.window_number ?? 0) + 1
    setEditingWindowId(null)
    setWindowForm(defaultWindowForm(nextNumber))
  }

  async function handleLockWindow() {
    if (!editingWindowId) return

    setWindowSaving(true)
    setPageError(null)

    try {
      await adminLockSelectionWindow(editingWindowId)
      await loadAdminData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to lock selection window.'
      setPageError(message)
    } finally {
      setWindowSaving(false)
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
        description="Payments and selection windows"
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
                <div>
                  Game {game.game_number} • {game.season}
                </div>
                <div>Status: {game.status}</div>
                <div>Pot: {formatGBP(game.current_pot)}</div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Game 27 not found. Run the seed SQL in Supabase.</p>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-text">Selection window</h2>
              <button
                type="button"
                onClick={() => void handleCreateNewWindow()}
                className="rounded-lg border border-border bg-surface px-3 py-1 text-xs hover:bg-surface-2"
              >
                New window
              </button>
            </div>

            {currentWindow ? (
              <p className="mt-2 text-xs text-muted">
                Current window: #{currentWindow.window_number} • status {currentWindow.status}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted">No selection window created yet.</p>
            )}

            {game ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-muted">Window number</span>
                  <input
                    type="number"
                    min={1}
                    value={windowForm.window_number}
                    onChange={(e) =>
                      setWindowForm((prev) => ({ ...prev, window_number: Number(e.target.value) }))
                    }
                    className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-muted">Status</span>
                  <select
                    value={windowForm.status}
                    onChange={(e) =>
                      setWindowForm((prev) => ({
                        ...prev,
                        status: e.target.value as SelectionWindowStatus,
                      }))
                    }
                    className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                  >
                    {windowStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-muted">Start</span>
                  <input
                    type="datetime-local"
                    value={windowForm.start_at}
                    onChange={(e) => setWindowForm((prev) => ({ ...prev, start_at: e.target.value }))}
                    className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-muted">End</span>
                  <input
                    type="datetime-local"
                    value={windowForm.end_at}
                    onChange={(e) => setWindowForm((prev) => ({ ...prev, end_at: e.target.value }))}
                    className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                  />
                </label>

                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs font-semibold text-muted">Deadline</span>
                  <input
                    type="datetime-local"
                    value={windowForm.deadline_at}
                    onChange={(e) => setWindowForm((prev) => ({ ...prev, deadline_at: e.target.value }))}
                    className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                  />
                </label>
              </div>
            ) : null}

            {game ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={windowSaving}
                  onClick={() => void handleSaveWindow()}
                  className="rounded-lg border border-accent bg-accent px-3 py-2 text-sm font-semibold text-bg disabled:opacity-50"
                >
                  {windowSaving ? 'Saving...' : editingWindowId ? 'Update window' : 'Create window'}
                </button>
                {editingWindowId ? (
                  <button
                    type="button"
                    disabled={windowSaving}
                    onClick={() => void handleLockWindow()}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-50"
                  >
                    Lock window
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-text">Payments</h2>

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
