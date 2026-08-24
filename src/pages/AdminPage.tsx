import { useCallback, useEffect, useMemo, useState } from 'react'
import { ButtonLink } from '../components/ButtonLink'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { AdminAdvancedOperationsSection } from '../components/admin/AdminAdvancedOperationsSection'
import { AdminCommunicationsSection } from '../components/admin/AdminCommunicationsSection'
import { AdminPlayersPaymentsSection } from '../components/admin/AdminPlayersPaymentsSection'
import { AdminProxyPicksSection } from '../components/admin/AdminProxyPicksSection'
import { AdminRoundControlCard } from '../components/admin/AdminRoundControlCard'
import { AdminRoundResultsSection, type ResultSyncSummary } from '../components/admin/AdminRoundResultsSection'
import { AdminThisRoundSection } from '../components/admin/AdminThisRoundSection'
import { useAuth, authPhaseLabel } from '../contexts/AuthContext'
import { useGame } from '../contexts/GameContext'
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
  formatDeadlineLondon,
  invokeFixtureReconciliation,
  invokeFixtureResultSync,
} from '../lib/fixtureOps'
import { buildWindow2ReadinessPreview } from '../lib/window2Preview'
import { compareDraftSnapshotToMaster, WINDOW2_NUMBER } from '../lib/window2Draft'
import {
  adminApplyRoundResolution,
  adminCountSelectionsForWindow,
  adminFetchAllWindowSelections,
  adminFetchSelectionWindows,
  adminFetchWindowSelections,
  adminLockSelectionWindow,
  adminOpenNextRound,
  adminSubmitSelection,
} from '../lib/selections'
import { canOpenNextRound } from '../lib/nextRound'
import { mergeEligibleFixturesWithResults, resolveRoundPreview } from '../lib/roundResolution'
import { isProtectedHistoricWindow } from '../lib/windowGuards'
import {
  adminCreateManualPlayer,
  adminFetchGameEntries,
  adminFetchPlayers,
  adminSetEntryType,
  adminUpdateCurrentPot,
  adminVerifyPayment,
  fetchCurrentGame,
} from '../lib/gameEntries'
import {
  buildSelectionCsv,
  buildSelectionExportRows,
  buildWhatsAppSelectionSummary,
} from '../lib/selectionExport'
import { operationalWindowToRoundLabel } from '../lib/round1'
import type {
  EntryType,
  FixtureChangeEvent,
  FixtureSyncRun,
  Game,
  GameEntryWithPlayer,
  Player,
  Selection,
  SelectionWindowEligibleFixture,
  SelectionWindowWithMeta,
  SeasonFixture,
} from '../types'

export function AdminPage() {
  const { user, player, loading, authPhase } = useAuth()
  const { currentPot, applyGameUpdate } = useGame()
  const [game, setGame] = useState<Game | null>(null)
  const [entries, setEntries] = useState<GameEntryWithPlayer[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [windows, setWindows] = useState<SelectionWindowWithMeta[]>([])
  const [candidates, setCandidates] = useState<SelectionWindowWithMeta[]>([])
  const [openFixtures, setOpenFixtures] = useState<SelectionWindowEligibleFixture[]>([])
  const [windowSelections, setWindowSelections] = useState<Selection[]>([])
  const [selectionsMade, setSelectionsMade] = useState(0)
  const [candidateFixtures, setCandidateFixtures] = useState<Record<string, SelectionWindowEligibleFixture[]>>({})
  const [syncRuns, setSyncRuns] = useState<FixtureSyncRun[]>([])
  const [changeAlerts, setChangeAlerts] = useState<FixtureChangeEvent[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [advancedLoading, setAdvancedLoading] = useState(false)
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
  const [syncSummary, setSyncSummary] = useState<ResultSyncSummary | null>(null)
  const [nextDeadlineLocal, setNextDeadlineLocal] = useState('')
  const [allWindowSelections, setAllWindowSelections] = useState<Selection[]>([])

  const openWindow =
    windows.find((w) => w.status === 'open' && !isProtectedHistoricWindow(w.window_number)) ?? null

  const operationalWindow =
    windows
      .filter((w) => !isProtectedHistoricWindow(w.window_number))
      .filter((w) => w.status === 'open' || w.status === 'locked' || w.status === 'resolving' || w.status === 'resolved')
      .sort((a, b) => b.window_number - a.window_number)[0] ?? null

  const loadAdminCore = useCallback(async () => {
    if (!player?.is_admin) {
      setPageLoading(false)
      return
    }

    setPageLoading(true)
    setPageError(null)

    try {
      const currentGame = await fetchCurrentGame()
      setGame(currentGame)
      if (currentGame) applyGameUpdate(currentGame)

      if (!currentGame) {
        setEntries([])
        setPlayers([])
        setWindows([])
        setOpenFixtures([])
        setWindowSelections([])
        setSelectionsMade(0)
        return
      }

      const [gameEntries, gamePlayers, gameWindows] = await Promise.all([
        adminFetchGameEntries(currentGame.id),
        adminFetchPlayers(),
        adminFetchSelectionWindows(currentGame.id) as Promise<SelectionWindowWithMeta[]>,
      ])

      setEntries(gameEntries)
      setPlayers(gamePlayers)
      setWindows(gameWindows)

      const liveWindow =
        gameWindows
          .filter((w) => !isProtectedHistoricWindow(w.window_number))
          .filter((w) => w.status === 'open' || w.status === 'locked' || w.status === 'resolving' || w.status === 'resolved')
          .sort((a, b) => b.window_number - a.window_number)[0] ?? null

      const [seasonRows] = await Promise.all([fetchSeasonFixtures(currentGame.season || '2026/27')])
      setSeasonFixtures(seasonRows)

      if (liveWindow) {
        const [fixtures, pickCount, picks, allPicks] = await Promise.all([
          fetchWindowEligibleFixtures(liveWindow.id),
          adminCountSelectionsForWindow(liveWindow.id),
          adminFetchWindowSelections(liveWindow.id),
          adminFetchAllWindowSelections(liveWindow.id),
        ])
        setOpenFixtures(fixtures)
        setSelectionsMade(pickCount)
        setWindowSelections(picks)
        setAllWindowSelections(allPicks)
      } else {
        setOpenFixtures([])
        setSelectionsMade(0)
        setWindowSelections([])
        setAllWindowSelections([])
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load admin data.'
      setPageError(message)
    } finally {
      setPageLoading(false)
    }
  }, [player?.is_admin, applyGameUpdate])

  const loadAdminAdvanced = useCallback(async () => {
    if (!player?.is_admin || !game) return

    setAdvancedLoading(true)
    try {
      const [pending, runs, alerts, opsStatus, seasonRows] = await Promise.all([
        fetchPendingCandidateWindows(game.id),
        fetchRecentSyncRuns(),
        fetchFixtureChangeAlerts(),
        fetchFixtureOpsStatus().catch(() => ({ providerConfigured: false, schedulerConfigured: false })),
        fetchSeasonFixtures('2026/27'),
      ])

      setCandidates(pending)
      setSyncRuns(runs)
      setChangeAlerts(alerts)
      setProviderConfigured(opsStatus.providerConfigured)
      setSchedulerConfigured(opsStatus.schedulerConfigured)
      setWindow2Preview(buildWindow2ReadinessPreview(seasonRows, windows))
      setSeasonFixtures(seasonRows)

      const fixtureEntries = await Promise.all(
        pending.map(async (candidate) => [candidate.id, await fetchWindowEligibleFixtures(candidate.id)] as const),
      )
      setCandidateFixtures(Object.fromEntries(fixtureEntries))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load advanced admin data.'
      setPageError(message)
    } finally {
      setAdvancedLoading(false)
    }
  }, [game, player?.is_admin, windows])

  useEffect(() => {
    if (!loading) void loadAdminCore()
  }, [loading, loadAdminCore])

  useEffect(() => {
    if (!pageLoading && game && player?.is_admin) void loadAdminAdvanced()
  }, [pageLoading, game, player?.is_admin, loadAdminAdvanced])

  async function handleVerifyPayment(entryId: string) {
    if (!game) return
    setActionId(entryId)
    setPageError(null)
    try {
      await adminVerifyPayment(entryId)
      await loadAdminCore()
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
      await loadAdminCore()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to update entry type.')
    } finally {
      setActionId(null)
    }
  }

  async function handleSavePot(value: number) {
    if (!game) return
    setActionId('pot')
    setPageError(null)
    try {
      const updated = await adminUpdateCurrentPot(game.id, value)
      setGame(updated)
      applyGameUpdate(updated)
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to update pot.')
    } finally {
      setActionId(null)
    }
  }

  async function handleCreateManualPlayer(displayName: string, phone: string) {
    setActionId('manual-player')
    setPageError(null)
    try {
      await adminCreateManualPlayer(displayName, phone)
      await loadAdminCore()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to create manual player.')
      throw err
    } finally {
      setActionId(null)
    }
  }

  async function handleSaveProxyPick(playerId: string, teamId: string) {
    if (!openWindow) return
    setActionId('proxy-pick')
    setPageError(null)
    try {
      await adminSubmitSelection({ playerId, windowId: openWindow.id, teamId })
      await loadAdminCore()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to save proxy pick.')
      throw err
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
      await loadAdminCore()
      await loadAdminAdvanced()
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
      await loadAdminCore()
      await loadAdminAdvanced()
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
      await loadAdminAdvanced()
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
      await loadAdminCore()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to lock window.')
    } finally {
      setFixtureBusy(false)
    }
  }

  async function handleSyncLatestResults() {
    setActionId('sync-results')
    setPageError(null)
    try {
      const result = await invokeFixtureResultSync()
      setSyncSummary({
        lastSyncAt: result.lastSyncAt ?? new Date().toISOString(),
        fixturesChecked: result.fixturesChecked ?? 0,
        fixturesUpdated: result.fixturesUpdated ?? 0,
        unresolved: result.unresolved ?? [],
        ambiguousCount: result.ambiguous?.length ?? 0,
        unmatchedCount: result.unmatchedCount ?? 0,
        providerErrors: result.providerErrors ?? [],
        result: result.result,
      })
      await loadAdminCore()
      await loadAdminAdvanced()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to sync latest results.')
    } finally {
      setActionId(null)
    }
  }

  async function handleResolveRound() {
    if (!operationalWindow) return
    setActionId('resolve-round')
    setPageError(null)
    try {
      const result = await adminApplyRoundResolution(operationalWindow.id)
      setReconcileMessage(
        result.result === 'already_resolved' ? 'This round is already resolved.' : 'Round resolved.',
      )
      await loadAdminCore()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to resolve round.')
    } finally {
      setActionId(null)
    }
  }

  async function handleOpenNextRound() {
    if (!operationalWindow) return
    setActionId('open-next-round')
    setPageError(null)
    try {
      const check = canOpenNextRound({
        currentWindow: operationalWindow,
        windows,
        fixtures: seasonFixtures,
        survivorCount: entries.filter((entry) => entry.paid && entry.status === 'active').length,
      })
      const deadlineAt = nextDeadlineLocal ? new Date(nextDeadlineLocal).toISOString() : check.weekend?.proposedDeadline
      if (!check.weekend || !deadlineAt) {
        throw new Error('Choose a deadline before opening the next round.')
      }
      const result = await adminOpenNextRound({
        currentWindowId: operationalWindow.id,
        sat: check.weekend.sat,
        sun: check.weekend.sun,
        deadlineAt,
      })
      const fixtureCount = Number(result.fixture_count ?? check.weekend.eligible.length)
      const survivorCount = Number(result.survivor_count ?? check.survivorCount)
      setReconcileMessage(
        result.result === 'already_open'
          ? 'The next round is already open.'
          : `Round opened · ${fixtureCount} fixtures · ${survivorCount} survivors · deadline ${formatDeadlineLondon(String(result.deadline_at ?? deadlineAt))}`,
      )
      await loadAdminCore()
      await loadAdminAdvanced()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to open the next round.')
    } finally {
      setActionId(null)
    }
  }

  async function handleRevalidateDraft(windowId: string) {
    setActionId(windowId)
    setPageError(null)
    try {
      await adminRefreshDraftWindowSnapshot(windowId)
      await loadAdminAdvanced()
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

  const paymentSummary = buildPlayerPaymentSummary(entries, players)
  const roundControl = operationalWindow
    ? buildRoundControlStats({
        openWindow: operationalWindow,
        snapshotFixtures: openFixtures,
        entries,
        selectionsMade,
      })
    : null

  const resolutionFixtures = mergeEligibleFixturesWithResults(openFixtures, seasonFixtures)
  const resolutionPreview = operationalWindow
    ? resolveRoundPreview({
        window: operationalWindow,
        fixtures: resolutionFixtures,
        entries: entries.map((entry) => ({
          player_id: entry.player_id,
          display_name: entry.player?.display_name ?? 'Player',
          status: entry.status,
          paid: entry.paid,
        })),
        selections: allWindowSelections.map((selection) => ({
          player_id: selection.player_id,
          team_id: selection.team_id,
          updated_at: selection.updated_at,
          created_at: selection.created_at,
          used_final: selection.used_final,
          outcome: selection.outcome,
          outcome_reason: selection.outcome_reason,
        })),
      })
    : null

  const nextRoundCheck = operationalWindow
    ? canOpenNextRound({
        currentWindow: operationalWindow,
        windows,
        fixtures: seasonFixtures,
        survivorCount: entries.filter((entry) => entry.paid && entry.status === 'active').length,
      })
    : {
        canOpen: false,
        reason: 'No current operational round.',
        survivorCount: 0,
        alreadyOpen: false,
        weekend: null,
      }

  useEffect(() => {
    const proposed = nextRoundCheck.weekend?.proposedDeadline
    if (proposed && !nextDeadlineLocal) {
      const date = new Date(proposed)
      if (!Number.isNaN(date.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0')
        setNextDeadlineLocal(
          `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`,
        )
      }
    }
  }, [nextRoundCheck.weekend?.proposedDeadline, nextDeadlineLocal])

  const exportRows = game
    ? buildSelectionExportRows({
        selections: windowSelections,
        entries,
        fixtures: openFixtures,
        game,
      })
    : []
  const roundLabel = openWindow ? operationalWindowToRoundLabel(openWindow.window_number) : 'Round 1'
  const whatsAppSummary = openWindow
    ? buildWhatsAppSelectionSummary({
        roundLabel,
        deadlineAt: openWindow.deadline_at,
        rows: exportRows,
      })
    : ''
  const csvContents = openWindow
    ? buildSelectionCsv({
        roundLabel,
        deadlineAt: openWindow.deadline_at,
        rows: exportRows,
      })
    : ''

  const existingSelectionByPlayer = useMemo(
    () => new Map(windowSelections.map((selection) => [selection.player_id, selection])),
    [windowSelections],
  )

  if (loading || pageLoading) {
    return (
      <Card
        title="Organiser cockpit"
        description={loading ? authPhaseLabel(authPhase) : 'Loading admin data…'}
        compact
      >
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
            <button type="button" onClick={() => void loadAdminCore()} className="ml-2 underline">
              Retry
            </button>
          </div>
        ) : null}
        {reconcileMessage ? <div className="mb-2 los-alert los-alert-success">{reconcileMessage}</div> : null}
        {advancedLoading ? <p className="mb-2 text-xs text-muted-ink">Loading admin diagnostics…</p> : null}

        <div className="grid gap-3">
          {roundControl ? (
            <AdminRoundControlCard
              stats={roundControl}
              currentPot={game?.current_pot ?? currentPot ?? 0}
              potBusy={actionId === 'pot'}
              onSavePot={(value) => void handleSavePot(value)}
            />
          ) : (
            <section className="los-admin-section los-cockpit-card">
              <h2 className="los-section-title">Round control</h2>
              <p className="mt-2 text-xs text-muted-ink">
                No live round is open yet. Use advanced operations to revalidate and publish when ready.
              </p>
            </section>
          )}

          {operationalWindow && resolutionPreview ? (
            <AdminRoundResultsSection
              window={operationalWindow}
              preview={resolutionPreview}
              syncSummary={syncSummary}
              nextRound={nextRoundCheck}
              deadlineValue={nextDeadlineLocal}
              onDeadlineChange={setNextDeadlineLocal}
              syncBusy={actionId === 'sync-results'}
              resolveBusy={actionId === 'resolve-round'}
              openBusy={actionId === 'open-next-round'}
              onSyncResults={() => void handleSyncLatestResults()}
              onResolveRound={() => void handleResolveRound()}
              onOpenNextRound={() => void handleOpenNextRound()}
            />
          ) : null}

          {openWindow ? (
            <>
              <AdminThisRoundSection
                openWindow={openWindow}
                fixtures={openFixtures}
                whatsAppSummary={whatsAppSummary}
                csvContents={csvContents}
              />
              <AdminProxyPicksSection
                players={players}
                fixtures={openFixtures}
                existingSelectionByPlayer={existingSelectionByPlayer}
                busy={actionId === 'proxy-pick' || actionId === 'manual-player'}
                onCreateManualPlayer={handleCreateManualPlayer}
                onSaveProxyPick={handleSaveProxyPick}
              />
            </>
          ) : null}

          {game ? (
            <AdminPlayersPaymentsSection
              game={game}
              entries={entries}
              summary={paymentSummary}
              actionId={actionId}
              onVerifyPayment={(id) => void handleVerifyPayment(id)}
              onSetEntryType={(id, type) => void handleSetEntryType(id, type)}
            />
          ) : null}
          <AdminCommunicationsSection />

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
