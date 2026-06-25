import { useCallback, useEffect, useState } from 'react'
import { ButtonLink } from '../components/ButtonLink'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { MetricCell, MetricStrip } from '../components/MetricCell'
import { Window2ReadinessPreviewPanel } from '../components/Window2ReadinessPreviewPanel'
import { useAuth } from '../contexts/AuthContext'
import {
  adminApproveWindow,
  adminReviewWindow,
  fetchFixtureChangeAlerts,
  fetchFixtureOpsStatus,
  fetchPendingCandidateWindows,
  fetchRecentSyncRuns,
  fetchSeasonFixtures,
  fetchWindowEligibleFixtures,
  formatLondonDateTime,
  invokeFixtureReconciliation,
} from '../lib/fixtureOps'
import { buildWindow2ReadinessPreview, type Window2ReadinessPreview } from '../lib/window2Preview'
import {
  adminFetchSelectionWindows,
  adminLockSelectionWindow,
} from '../lib/selections'
import { isProtectedHistoricWindow } from '../lib/windowGuards'
import {
  adminFetchGameEntries,
  adminSetEntryType,
  adminVerifyPayment,
  fetchCurrentGame,
} from '../lib/gameEntries'
import { formatGBP, formatEligibleSelectionDays } from '../lib/constants'
import type {
  EntryType,
  FixtureChangeEvent,
  FixtureSyncRun,
  Game,
  GameEntryWithPlayer,
  SelectionWindowEligibleFixture,
  SelectionWindowWithMeta,
} from '../types'

const placeholderSections = [
  { title: 'Result resolution', body: 'Placeholder for manual resolution until automation is added.' },
  { title: 'Historical results management', body: 'Placeholder for editing seeded history data.' },
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
  const [windows, setWindows] = useState<SelectionWindowWithMeta[]>([])
  const [candidates, setCandidates] = useState<SelectionWindowWithMeta[]>([])
  const [candidateFixtures, setCandidateFixtures] = useState<Record<string, SelectionWindowEligibleFixture[]>>({})
  const [syncRuns, setSyncRuns] = useState<FixtureSyncRun[]>([])
  const [changeAlerts, setChangeAlerts] = useState<FixtureChangeEvent[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [fixtureBusy, setFixtureBusy] = useState(false)
  const [reconcileMessage, setReconcileMessage] = useState<string | null>(null)
  const [testSatDate, setTestSatDate] = useState('')
  const [testSunDate, setTestSunDate] = useState('')

  const [providerConfigured, setProviderConfigured] = useState(false)
  const [schedulerConfigured, setSchedulerConfigured] = useState(false)
  const [window2Preview, setWindow2Preview] = useState<Window2ReadinessPreview | null>(null)

  const openWindow = windows.find((w) => w.status === 'open' && !isProtectedHistoricWindow(w.window_number)) ?? null

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
        const [gameEntries, gameWindows, pending, runs, alerts, opsStatus, seasonFixtures] = await Promise.all([
          adminFetchGameEntries(currentGame.id),
          adminFetchSelectionWindows(currentGame.id) as Promise<SelectionWindowWithMeta[]>,
          fetchPendingCandidateWindows(currentGame.id),
          fetchRecentSyncRuns(),
          fetchFixtureChangeAlerts(),
          fetchFixtureOpsStatus().catch(() => ({ providerConfigured: false, schedulerConfigured: false })),
          fetchSeasonFixtures('2026/27'),
        ])
        setEntries(gameEntries)
        setWindows(gameWindows)
        setCandidates(pending)
        setSyncRuns(runs)
        setChangeAlerts(alerts)
        setProviderConfigured(opsStatus.providerConfigured)
        setSchedulerConfigured(opsStatus.schedulerConfigured)
        setWindow2Preview(buildWindow2ReadinessPreview(seasonFixtures, gameWindows))

        const fixtureMap: Record<string, SelectionWindowEligibleFixture[]> = {}
        for (const candidate of pending) {
          fixtureMap[candidate.id] = await fetchWindowEligibleFixtures(candidate.id)
        }
        setCandidateFixtures(fixtureMap)
      } else {
        setEntries([])
        setWindows([])
        setCandidates([])
        setSyncRuns([])
        setChangeAlerts([])
        setCandidateFixtures({})
        setProviderConfigured(false)
        setSchedulerConfigured(false)
        setWindow2Preview(null)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load admin data.'
      setPageError(message)
    } finally {
      setPageLoading(false)
    }
  }, [player?.is_admin])

  useEffect(() => {
    if (!loading) void loadAdminData()
  }, [loading, loadAdminData])

  async function handleVerifyPayment(entryId: string) {
    if (!game) return
    setActionId(entryId)
    setPageError(null)
    try {
      await adminVerifyPayment(entryId)
      await loadAdminData()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to verify payment.')
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
      setPageError(err instanceof Error ? err.message : 'Failed to update entry type.')
    } finally {
      setActionId(null)
    }
  }

  async function handleReconcile(testWeekend = false) {
    setFixtureBusy(true)
    setPageError(null)
    setReconcileMessage(null)
    try {
      const result = await invokeFixtureReconciliation(
        testWeekend && testSatDate && testSunDate
          ? { targetSatDate: testSatDate, targetSunDate: testSunDate, sourceType: 'manual' }
          : { sourceType: 'manual' },
      )
      setReconcileMessage(String(result.result ?? 'completed'))
      await loadAdminData()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Reconciliation failed.')
    } finally {
      setFixtureBusy(false)
    }
  }

  async function handleApproveCandidate(windowId: string) {
    setActionId(windowId)
    setPageError(null)
    try {
      await adminApproveWindow(windowId)
      await loadAdminData()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to approve candidate.')
    } finally {
      setActionId(null)
    }
  }

  async function handleReviewCandidate(windowId: string, outcome: 'deferred' | 'rejected') {
    setActionId(windowId)
    setPageError(null)
    try {
      await adminReviewWindow(windowId, outcome)
      await loadAdminData()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to update candidate.')
    } finally {
      setActionId(null)
    }
  }

  async function handleLockOpenWindow() {
    if (!openWindow) return
    setFixtureBusy(true)
    setPageError(null)
    try {
      await adminLockSelectionWindow(openWindow.id)
      await loadAdminData()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to lock window.')
    } finally {
      setFixtureBusy(false)
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
        {reconcileMessage ? <div className="mb-2 los-alert los-alert-success">{reconcileMessage}</div> : null}

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
            <h2 className="los-section-title">Fixture operations</h2>
            <p className="mt-1 text-xs text-muted-ink">
              Provider monitoring:{' '}
              {providerConfigured
                ? 'configured (server-side API Football key present)'
                : 'not configured — manual reconciliation from staged master fixtures only'}
            </p>
            <p className="mt-1 text-xs text-muted-ink">
              Scheduled external monitoring: {schedulerConfigured ? 'credentials present' : 'not enabled'}
            </p>
            <p className="mt-1 text-xs text-muted-ink">
              {formatEligibleSelectionDays()} windows only. Window 1 is a protected historic test placeholder and is
              excluded from reconciliation, approval, and player picks.
            </p>

            {windows.some((w) => isProtectedHistoricWindow(w.window_number)) ? (
              <div className="mt-2 los-notice text-xs">
                Protected historic window #1 — test configuration only; no operational actions permitted.
              </div>
            ) : null}

            {window2Preview ? <Window2ReadinessPreviewPanel preview={window2Preview} /> : null}

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={fixtureBusy}
                onClick={() => void handleReconcile(false)}
                className="los-btn-primary disabled:opacity-50"
              >
                {fixtureBusy ? 'Running…' : 'Run reconciliation'}
              </button>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="grid gap-0.5">
                <span className="los-section-title">Test Saturday</span>
                <input type="date" value={testSatDate} onChange={(e) => setTestSatDate(e.target.value)} className="los-input !h-8" />
              </label>
              <label className="grid gap-0.5">
                <span className="los-section-title">Test Sunday</span>
                <input type="date" value={testSunDate} onChange={(e) => setTestSunDate(e.target.value)} className="los-input !h-8" />
              </label>
            </div>
            <button
              type="button"
              disabled={fixtureBusy || !testSatDate || !testSunDate}
              onClick={() => void handleReconcile(true)}
              className="mt-2 los-btn-secondary disabled:opacity-50"
            >
              Run test weekend reconciliation
            </button>

            {changeAlerts.length > 0 ? (
              <div className="mt-2 los-alert los-alert-error text-xs">
                {changeAlerts.length} material fixture change alert(s) require organiser review.
              </div>
            ) : null}

            {openWindow ? (
              <div className="mt-2 los-notice text-xs">
                Open window #{openWindow.window_number} · deadline {formatLondonDateTime(openWindow.deadline_at)}
                <button type="button" onClick={() => void handleLockOpenWindow()} className="ml-2 los-admin-btn">
                  Lock now
                </button>
              </div>
            ) : null}

            {candidates.length === 0 ? (
              <p className="mt-2 text-xs text-muted-ink">No pending candidate windows.</p>
            ) : (
              candidates.map((candidate) => {
                const fixtures = candidateFixtures[candidate.id] ?? []
                const busy = actionId === candidate.id
                return (
                  <div key={candidate.id} className="mt-2 border-t border-border pt-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-medium text-ink">
                        Candidate window #{candidate.window_number} · {candidate.eligible_sat_date} – {candidate.eligible_sun_date}
                      </div>
                      <Badge variant="warning">pending review</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-ink">
                      Deadline {formatLondonDateTime(candidate.deadline_at)} · {fixtures.length} fixtures
                    </p>
                    <div className="mt-1 max-h-40 overflow-y-auto text-xs text-muted-ink">
                      {fixtures.map((f) => (
                        <div key={f.id}>
                          {formatLondonDateTime(f.kickoff_at)} · {f.home_team_name} v {f.away_team_name}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" disabled={busy} onClick={() => void handleApproveCandidate(candidate.id)} className="los-btn-primary disabled:opacity-50">
                        Approve
                      </button>
                      <button type="button" disabled={busy} onClick={() => void handleReviewCandidate(candidate.id, 'deferred')} className="los-admin-btn disabled:opacity-50">
                        Defer
                      </button>
                      <button type="button" disabled={busy} onClick={() => void handleReviewCandidate(candidate.id, 'rejected')} className="los-admin-btn disabled:opacity-50">
                        Reject
                      </button>
                    </div>
                  </div>
                )
              })
            )}

            {syncRuns.length > 0 ? (
              <div className="mt-2 text-xs text-muted-ink">
                Latest sync: {syncRuns[0].run_result} · {syncRuns[0].validation_status} · {syncRuns[0].fixture_total} fixtures
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
                                <button type="button" disabled={busy} onClick={() => void handleVerifyPayment(row.id)} className="los-admin-btn disabled:opacity-50">
                                  Verify
                                </button>
                              ) : null}
                              <button type="button" disabled={busy} onClick={() => void handleSetEntryType(row.id, 'existing')} className="los-admin-btn disabled:opacity-50">
                                Existing
                              </button>
                              <button type="button" disabled={busy} onClick={() => void handleSetEntryType(row.id, 'newbie')} className="los-admin-btn disabled:opacity-50">
                                Newbie
                              </button>
                              <button type="button" disabled={busy} onClick={() => void handleSetEntryType(row.id, 'admin_comp')} className="los-admin-btn disabled:opacity-50">
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
