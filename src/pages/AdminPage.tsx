import { useCallback, useEffect, useState } from 'react'
import { ButtonLink } from '../components/ButtonLink'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { MetricCell, MetricStrip } from '../components/MetricCell'
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
import { formatGBP, formatEligibleSelectionDays } from '../lib/constants'
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
      <Card title="Admin" description="Loading…" compact>
        <p className="text-xs text-muted-ink">Please wait.</p>
      </Card>
    )
  }

  if (!user) {
    return (
      <Card title="Admin" description="Login required" compact>
        <p className="text-xs text-muted-ink mb-2">Log in with an admin account.</p>
        <ButtonLink to="/login">Log in</ButtonLink>
      </Card>
    )
  }

  if (!player?.is_admin) {
    return (
      <Card title="Admin" description="Access denied" compact>
        <p className="text-xs text-muted-ink">You do not have admin access.</p>
      </Card>
    )
  }

  return (
    <div className="grid gap-3">
      <Card title="Admin" description="Operations console" right={<Badge variant="muted">Admin</Badge>} compact>
        {pageError ? <div className="mb-2 los-alert los-alert-error">{pageError}</div> : null}

        <div className="grid gap-3">
          <section className="los-admin-section">
            <h2 className="los-section-title">Game</h2>
            {game ? (
              <MetricStrip className="mt-2">
                <MetricCell label="Game" value={game.game_number} />
                <MetricCell label="Season" value={game.season} />
                <MetricCell label="Status" value={game.status} />
                <MetricCell label="Pot" value={formatGBP(game.current_pot)} />
              </MetricStrip>
            ) : (
              <p className="mt-1 text-xs text-muted-ink">Game 27 not found. Run seed SQL.</p>
            )}
          </section>

          <section className="los-admin-section">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="los-section-title">Selection window</h2>
              <button type="button" onClick={() => void handleCreateNewWindow()} className="los-admin-btn">
                New window
              </button>
            </div>

            {currentWindow ? (
              <p className="mt-1 text-xs text-muted-ink">
                Window #{currentWindow.window_number} · {currentWindow.status}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-ink">No window created.</p>
            )}

            <div className="mt-2 los-notice text-xs">
              {formatEligibleSelectionDays()} rounds only. No Friday/Monday. Deadline 1hr before first eligible
              kickoff.
            </div>

            {game ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="grid gap-0.5">
                  <span className="los-section-title">Window #</span>
                  <input
                    type="number"
                    min={1}
                    value={windowForm.window_number}
                    onChange={(e) =>
                      setWindowForm((prev) => ({ ...prev, window_number: Number(e.target.value) }))
                    }
                    className="los-input !h-8"
                  />
                </label>

                <label className="grid gap-0.5">
                  <span className="los-section-title">Status</span>
                  <select
                    value={windowForm.status}
                    onChange={(e) =>
                      setWindowForm((prev) => ({
                        ...prev,
                        status: e.target.value as SelectionWindowStatus,
                      }))
                    }
                    className="los-input !h-8"
                  >
                    {windowStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-0.5">
                  <span className="los-section-title">Start</span>
                  <input
                    type="datetime-local"
                    value={windowForm.start_at}
                    onChange={(e) => setWindowForm((prev) => ({ ...prev, start_at: e.target.value }))}
                    className="los-input !h-8"
                  />
                </label>

                <label className="grid gap-0.5">
                  <span className="los-section-title">End</span>
                  <input
                    type="datetime-local"
                    value={windowForm.end_at}
                    onChange={(e) => setWindowForm((prev) => ({ ...prev, end_at: e.target.value }))}
                    className="los-input !h-8"
                  />
                </label>

                <label className="grid gap-0.5 sm:col-span-2">
                  <span className="los-section-title">Deadline</span>
                  <input
                    type="datetime-local"
                    value={windowForm.deadline_at}
                    onChange={(e) => setWindowForm((prev) => ({ ...prev, deadline_at: e.target.value }))}
                    className="los-input !h-8"
                  />
                </label>
              </div>
            ) : null}

            {game ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={windowSaving}
                  onClick={() => void handleSaveWindow()}
                  className="los-btn-primary disabled:opacity-50"
                >
                  {windowSaving ? 'Saving…' : editingWindowId ? 'Update' : 'Create'}
                </button>
                {editingWindowId ? (
                  <button
                    type="button"
                    disabled={windowSaving}
                    onClick={() => void handleLockWindow()}
                    className="los-btn-secondary disabled:opacity-50"
                  >
                    Lock
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="los-admin-section">
            <h2 className="los-section-title mb-2">Payments</h2>

            {game ? (
              <DataTable minWidth="880px">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Type</th>
                    <th className="num">Due</th>
                    <th>Claimed</th>
                    <th>Paid</th>
                    <th>Paid at</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-muted-ink">
                        No entries.
                      </td>
                    </tr>
                  ) : (
                    entries.map((row) => {
                      const busy = actionId === row.id
                      return (
                        <tr key={row.id}>
                          <td className="font-medium">{row.player.display_name}</td>
                          <td className="text-muted-ink">{row.player.phone ?? '—'}</td>
                          <td className="text-muted-ink">{row.player.email}</td>
                          <td className="text-muted-ink">{formatEntryType(row.entry_type)}</td>
                          <td className="num tabular-nums">{formatGBP(row.amount_due)}</td>
                          <td className="text-muted-ink">{row.payment_claimed ? 'Y' : 'N'}</td>
                          <td className="text-muted-ink">{row.paid ? 'Y' : 'N'}</td>
                          <td className="text-muted-ink text-[0.6875rem]">
                            {row.paid_at ? new Date(row.paid_at).toLocaleString('en-GB') : '—'}
                          </td>
                          <td className="text-muted-ink">{row.status}</td>
                          <td>
                            <div className="flex flex-wrap gap-0.5">
                                {!row.paid ? (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void handleVerifyPayment(row.id)}
                                    className="los-admin-btn disabled:opacity-50"
                                  >
                                    Verify
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleSetEntryType(row.id, 'existing')}
                                  className="los-admin-btn disabled:opacity-50"
                                >
                                  Existing
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleSetEntryType(row.id, 'newbie')}
                                  className="los-admin-btn disabled:opacity-50"
                                >
                                  Newbie
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleSetEntryType(row.id, 'admin_comp')}
                                  className="los-admin-btn disabled:opacity-50"
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
              </DataTable>
            ) : null}
          </section>

          <div className="los-divider-list text-xs">
            {placeholderSections.map((s) => (
              <div key={s.title} className="los-divider-row">
                <div className="font-medium text-ink">{s.title}</div>
                <div className="mt-0.5 text-muted-ink">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
