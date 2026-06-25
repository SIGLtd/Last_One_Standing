import { useCallback, useEffect, useState } from 'react'
import { ButtonLink } from '../components/ButtonLink'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { AdminAdvancedOperationsSection } from '../components/admin/AdminAdvancedOperationsSection'
import { AdminCommunicationsSection } from '../components/admin/AdminCommunicationsSection'
import { AdminPlayersPaymentsSection } from '../components/admin/AdminPlayersPaymentsSection'
import { AdminRoundControlCard } from '../components/admin/AdminRoundControlCard'
import { AdminThisRoundSection } from '../components/admin/AdminThisRoundSection'
import { useAuth } from '../contexts/AuthContext'
import { buildPlayerPaymentSummary, buildRoundControlStats } from '../lib/adminCockpit'
import {
  adminApproveWindow,
  adminRefreshDraftWindowSnapshot,
  adminReviewWindow,
  fetchFixtureChangeAlerts,
  fetchFixtureOpsStatus,
  fetchPendingCandidateWindows,
  fetchRecentSyncRuns,
  fetchSeasonFixtures,
  fetchWindowEligibleFixtures,
  invokeFixtureReconciliation,
} from '../lib/fixtureOps'
import { buildWindow2ReadinessPreview } from '../lib/window2Preview'
import { compareDraftSnapshotToMaster, WINDOW2_NUMBER } from '../lib/window2Draft'
import {
  adminCountSelectionsForWindow,
  adminFetchSelectionWindows,
  adminLockSelectionWindow,
} from '../lib/selections'
import { isProtectedHistoricWindow } from '../lib/windowGuards'
import {
  adminFetchGameEntries,
  adminFetchRegisteredPlayerCount,
  adminSetEntryType,
  adminVerifyPayment,
  fetchCurrentGame,
} from '../lib/gameEntries'
import type {
  EntryType,
  FixtureChangeEvent,
  FixtureSyncRun,
  Game,
  GameEntryWithPlayer,
  SelectionWindowEligibleFixture,
  SelectionWindowWithMeta,
  SeasonFixture,
} from '../types'

export function AdminPage() {
  const { user, player, loading } = useAuth()
  const [game, setGame] = useState<Game | null>(null)
  const [entries, setEntries] = useState<GameEntryWithPlayer[]>([])
  const [windows, setWindows] = useState<SelectionWindowWithMeta[]>([])
  const [candidates, setCandidates] = useState<SelectionWindowWithMeta[]>([])
  const [openFixtures, setOpenFixtures] = useState<SelectionWindowEligibleFixture[]>([])
  const [selectionsMade, setSelectionsMade] = useState(0)
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
  const [window2Preview, setWindow2Preview] = useState(
    null as ReturnType<typeof buildWindow2ReadinessPreview> | null,
  )
  const [seasonFixtures, setSeasonFixtures] = useState<SeasonFixture[]>([])
  const [registeredPlayerCount, setRegisteredPlayerCount] = useState(0)

  const openWindow =
    windows.find((w) => w.status === 'open' && !isProtectedHistoricWindow(w.window_number)) ?? null

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
        const [gameEntries, gameWindows, pending, runs, alerts, opsStatus, seasonRows, playerCount] =
          await Promise.all([
            adminFetchGameEntries(currentGame.id),
            adminFetchSelectionWindows(currentGame.id) as Promise<SelectionWindowWithMeta[]>,
            fetchPendingCandidateWindows(currentGame.id),
            fetchRecentSyncRuns(),
            fetchFixtureChangeAlerts(),
            fetchFixtureOpsStatus().catch(() => ({ providerConfigured: false, schedulerConfigured: false })),
            fetchSeasonFixtures('2026/27'),
            adminFetchRegisteredPlayerCount(),
          ])

        setEntries(gameEntries)
        setWindows(gameWindows)
        setCandidates(pending)
        setSyncRuns(runs)
        setChangeAlerts(alerts)
        setProviderConfigured(opsStatus.providerConfigured)
        setSchedulerConfigured(opsStatus.schedulerConfigured)
        setWindow2Preview(buildWindow2ReadinessPreview(seasonRows, gameWindows))
        setSeasonFixtures(seasonRows)
        setRegisteredPlayerCount(playerCount)

        const liveWindow =
          gameWindows.find((w) => w.status === 'open' && !isProtectedHistoricWindow(w.window_number)) ?? null

        if (liveWindow) {
          const [fixtures, pickCount] = await Promise.all([
            fetchWindowEligibleFixtures(liveWindow.id),
            adminCountSelectionsForWindow(liveWindow.id),
          ])
          setOpenFixtures(fixtures)
          setSelectionsMade(pickCount)
        } else {
          setOpenFixtures([])
          setSelectionsMade(0)
        }

        const fixtureMap: Record<string, SelectionWindowEligibleFixture[]> = {}
        for (const candidate of pending) {
          fixtureMap[candidate.id] = await fetchWindowEligibleFixtures(candidate.id)
        }
        setCandidateFixtures(fixtureMap)
      } else {
        setEntries([])
        setWindows([])
        setCandidates([])
        setOpenFixtures([])
        setSelectionsMade(0)
        setSyncRuns([])
        setChangeAlerts([])
        setCandidateFixtures({})
        setProviderConfigured(false)
        setSchedulerConfigured(false)
        setWindow2Preview(null)
        setSeasonFixtures([])
        setRegisteredPlayerCount(0)
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

  async function handleRevalidateDraft(windowId: string) {
    setActionId(windowId)
    setPageError(null)
    try {
      await adminRefreshDraftWindowSnapshot(windowId)
      await loadAdminData()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to revalidate draft snapshot.')
    } finally {
      setActionId(null)
    }
  }

  const window2Draft = candidates.find((candidate) => candidate.window_number === WINDOW2_NUMBER) ?? null
  const window2Snapshot = window2Draft ? (candidateFixtures[window2Draft.id] ?? []) : []
  const window2Comparison =
    window2Draft && seasonFixtures.length > 0
      ? compareDraftSnapshotToMaster(window2Snapshot, seasonFixtures)
      : null

  const paymentSummary = buildPlayerPaymentSummary(entries, registeredPlayerCount)
  const roundControl = openWindow
    ? buildRoundControlStats({
        openWindow,
        snapshotFixtures: openFixtures,
        entries,
        selectionsMade,
      })
    : null

  if (loading || pageLoading) {
    return (
      <Card title="Organiser cockpit" description="Loading…" compact>
        <p className="text-xs text-muted-ink">Please wait.</p>
      </Card>
    )
  }

  if (!user) {
    return (
      <Card title="Organiser cockpit" description="Login required" compact>
        <p className="text-xs text-muted-ink mb-2">Log in with an admin account.</p>
        <ButtonLink to="/login">Log in</ButtonLink>
      </Card>
    )
  }

  if (!player?.is_admin) {
    return (
      <Card title="Organiser cockpit" description="Access denied" compact>
        <p className="text-xs text-muted-ink">You do not have admin access.</p>
      </Card>
    )
  }

  return (
    <div className="grid gap-3">
      <Card
        title="Organiser cockpit"
        description={game ? `Game ${game.game_number}` : 'Game 27'}
        right={<Badge variant="muted">Admin</Badge>}
        compact
      >
        {pageError ? (
          <div className="mb-2 los-alert los-alert-error">
            {pageError}
            <button type="button" onClick={() => void loadAdminData()} className="ml-2 underline">
              Retry
            </button>
          </div>
        ) : null}
        {reconcileMessage ? <div className="mb-2 los-alert los-alert-success">{reconcileMessage}</div> : null}

        <div className="grid gap-3">
          {roundControl ? <AdminRoundControlCard stats={roundControl} /> : (
            <section className="los-admin-section los-cockpit-card">
              <h2 className="los-section-title">Round control</h2>
              <p className="mt-2 text-xs text-muted-ink">
                No live round is open yet. Use advanced operations to revalidate and publish when ready.
              </p>
            </section>
          )}

          {openWindow ? (
            <>
              <AdminThisRoundSection openWindow={openWindow} fixtures={openFixtures} />
              <AdminPlayersPaymentsSection
                entries={entries}
                summary={paymentSummary}
                actionId={actionId}
                onVerifyPayment={(id) => void handleVerifyPayment(id)}
                onSetEntryType={(id, type) => void handleSetEntryType(id, type)}
              />
              <AdminCommunicationsSection />
            </>
          ) : null}

          <AdminAdvancedOperationsSection
            game={game}
            entries={entries}
            windows={windows}
            candidates={candidates}
            candidateFixtures={candidateFixtures}
            syncRuns={syncRuns}
            changeAlerts={changeAlerts}
            window2Preview={window2Preview}
            seasonFixtures={seasonFixtures}
            providerConfigured={providerConfigured}
            schedulerConfigured={schedulerConfigured}
            openWindow={openWindow}
            window2Draft={window2Draft}
            window2Comparison={window2Comparison}
            window2Snapshot={window2Snapshot}
            fixtureBusy={fixtureBusy}
            actionId={actionId}
            testSatDate={testSatDate}
            testSunDate={testSunDate}
            onTestSatDateChange={setTestSatDate}
            onTestSunDateChange={setTestSunDate}
            onReconcile={(testWeekend) => void handleReconcile(testWeekend)}
            onLockOpenWindow={() => void handleLockOpenWindow()}
            onRevalidateDraft={(id) => void handleRevalidateDraft(id)}
            onApproveCandidate={(id) => void handleApproveCandidate(id)}
            onReviewCandidate={(id, outcome) => void handleReviewCandidate(id, outcome)}
            onVerifyPayment={(id) => void handleVerifyPayment(id)}
            onSetEntryType={(id, type) => void handleSetEntryType(id, type)}
          />
        </div>
      </Card>
    </div>
  )
}
