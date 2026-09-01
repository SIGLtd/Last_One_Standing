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
  adminApplyPostResultSelectionCorrection,
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
import { getAdminLiveOpenWindow, getAdminResolutionWindow } from '../lib/adminResolutionWindow'
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
  const [auditFixtures, setAuditFixtures] = useState<SelectionWindowEligibleFixture[]>([])

  const openWindow =
    windows.find((w) => w.status === 'open' && !isProtectedHistoricWindow(w.window_number)) ?? null

  const liveOpenWindow = getAdminLiveOpenWindow(windows)
  const auditWindow = getAdminResolutionWindow(windows)
  const thisRoundWindow = liveOpenWindow ?? auditWindow

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
        setAllWindowSelections([])
        setAuditFixtures([])
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

      const liveOpen = getAdminLiveOpenWindow(gameWindows)
      const audit = getAdminResolutionWindow(gameWindows)
      const thisRound = liveOpen ?? audit

      const [seasonRows] = await Promise.all([fetchSeasonFixtures(currentGame.season || '2026/27')])
      setSeasonFixtures(seasonRows)

      async function loadWindowBundle(windowId: string) {
        const [fixtures, pickCount, picks, allPicks] = await Promise.all([
          fetchWindowEligibleFixtures(windowId),
          adminCountSelectionsForWindow(windowId),
          adminFetchWindowSelections(windowId),
          adminFetchAllWindowSelections(windowId),
        ])
        return { fixtures, pickCount, picks, allPicks }
      }

      if (audit && thisRound && audit.id !== thisRound.id) {
        const [auditBundle, liveBundle] = await Promise.all([loadWindowBundle(audit.id), loadWindowBundle(thisRound.id)])
        setAuditFixtures(auditBundle.fixtures)
        setAllWindowSelections(auditBundle.allPicks)
        setOpenFixtures(liveBundle.fixtures)
        setSelectionsMade(liveBundle.pickCount)
        setWindowSelections(liveBundle.picks)
      } else if (audit) {
        const bundle = await loadWindowBundle(audit.id)
        setOpenFixtures(bundle.fixtures)
        setSelectionsMade(bundle.pickCount)
        setWindowSelections(bundle.picks)
        setAuditFixtures(bundle.fixtures)
        setAllWindowSelections(bundle.allPicks)
      } else if (thisRound) {
        const bundle = await loadWindowBundle(thisRound.id)
        setOpenFixtures(bundle.fixtures)
        setSelectionsMade(bundle.pickCount)
        setWindowSelections(bundle.picks)
        setAuditFixtures(bundle.fixtures)
        setAllWindowSelections(bundle.allPicks)
      } else {
        setOpenFixtures([])
        setSelectionsMade(0)
        setWindowSelections([])
        setAllWindowSelections([])
        setAuditFixtures([])
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
      setSeasonFixtures(seasonRows)
      const latestRun = runs[0] ?? null
      if (latestRun) {
        const successful = latestRun.run_result === 'results_synced'
        setSyncSummary((current) =>
          current?.result
            ? current
            : {
                lastSyncAt: latestRun.retrieved_at ?? latestRun.created_at,
                lastAttemptedAt: latestRun.created_at,
                lastSuccessfulAt: successful ? latestRun.retrieved_at ?? latestRun.created_at : null,
                fixturesChecked: latestRun.fixture_total ?? 0,
                fixturesUpdated: latestRun.changes_detected ?? 0,
                unresolved: [],
                ambiguousCount: 0,
                unmatchedCount: 0,
                missingFinalCount: 0,
                providerErrors: latestRun.error_summary ? [latestRun.error_summary] : [],
                result: latestRun.run_result,
              },
        )
      }
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
    const targetWindow = liveOpenWindow ?? openWindow
    if (!targetWindow) return
    setActionId('proxy-pick')
    setPageError(null)
    try {
      await adminSubmitSelection({ playerId, windowId: targetWindow.id, teamId })
      await loadAdminCore()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to save proxy pick.')
      throw err
    } finally {
      setActionId(null)
    }
  }

  async function handleSaveLatePick(playerId: string, teamId: string, reason: string, confirm: boolean) {
    const targetWindow = liveOpenWindow ?? openWindow ?? auditWindow
    if (!targetWindow) return
    setActionId('late-pick')
    setPageError(null)
    try {
      await adminApplyPostResultSelectionCorrection({
        playerId,
        windowId: targetWindow.id,
        teamId,
        reason,
        confirm,
      })
      await loadAdminCore()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to save late pick.')
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
        lastAttemptedAt: result.lastAttemptedAt ?? result.lastSyncAt ?? new Date().toISOString(),
        lastSuccessfulAt: result.lastSuccessfulAt ?? (result.result === 'results_synced' ? result.lastSyncAt : null),
        fixturesChecked: result.fixturesChecked ?? 0,
        fixturesUpdated: result.fixturesUpdated ?? 0,
        unresolved: result.unresolved ?? [],
        ambiguousCount: result.ambiguous?.length ?? 0,
        unmatchedCount: result.unmatchedCount ?? 0,
        missingFinalCount: result.missingFinalCount ?? result.unresolved?.length ?? 0,
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
    if (!auditWindow) return
    setActionId('resolve-round')
    setPageError(null)
    try {
      const result = await adminApplyRoundResolution(auditWindow.id)
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
    if (!auditWindow) return
    setActionId('open-next-round')
    setPageError(null)
    try {
      const check = canOpenNextRound({
        currentWindow: auditWindow,
        windows,
        fixtures: seasonFixtures,
        survivorCount: entries.filter((entry) => entry.paid && entry.status === 'active').length,
      })
      if (!check.canOpen) {
        throw new Error(check.reason ?? 'Cannot open the next round.')
      }
      const deadlineAt = nextDeadlineLocal ? new Date(nextDeadlineLocal).toISOString() : check.weekend?.proposedDeadline
      if (!check.weekend || !deadlineAt) {
        throw new Error('Choose a deadline before opening the next round.')
      }
      const result = await adminOpenNextRound({
        currentWindowId: auditWindow.id,
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
      const raw = err instanceof Error ? err.message : 'Failed to open the next round.'
      setPageError(
        raw.includes('NON_WEEKEND_FIXTURES')
          ? 'Cannot open this round because it includes Friday, Monday, or midweek fixtures. Only Saturday and Sunday fixtures are eligible unless Admin makes an explicit exception.'
          : raw,
      )
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
  const roundControl = thisRoundWindow
    ? buildRoundControlStats({
        openWindow: thisRoundWindow,
        snapshotFixtures: openFixtures,
        entries,
        selectionsMade,
      })
    : null

  const resolutionFixtures = mergeEligibleFixturesWithResults(auditFixtures, seasonFixtures)
  const eligibilityOverrides = Object.fromEntries(
    seasonFixtures.map((fixture) => [fixture.id, fixture.eligibility_override ?? 'none']),
  )
  const knownSubmittedPicks = allWindowSelections.filter((selection) => Boolean(selection.team_id)).length
  const resolutionPreview = auditWindow
    ? resolveRoundPreview({
        window: auditWindow,
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
          window_id: selection.window_id,
          updated_at: selection.updated_at,
          created_at: selection.created_at,
          used_final: selection.used_final,
          outcome: selection.outcome,
          outcome_reason: selection.outcome_reason,
        })),
        knownSubmittedPicks,
        eligibilityOverrides,
      })
    : null

  const nextRoundCheck = auditWindow
    ? canOpenNextRound({
        currentWindow: auditWindow,
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
  const pickWindow = liveOpenWindow ?? openWindow ?? auditWindow
  const roundLabel = pickWindow ? operationalWindowToRoundLabel(pickWindow.window_number) : 'Round 1'
  const whatsAppSummary = pickWindow
    ? buildWhatsAppSelectionSummary({
        roundLabel,
        deadlineAt: pickWindow.deadline_at,
        rows: exportRows,
      })
    : ''
  const csvContents = pickWindow
    ? buildSelectionCsv({
        roundLabel,
        deadlineAt: pickWindow.deadline_at,
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

          {auditWindow && resolutionPreview ? (
            <AdminRoundResultsSection
              window={auditWindow}
              preview={resolutionPreview}
              fixtureCount={auditFixtures.length}
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
              schedulerConfigured={schedulerConfigured}
            />
          ) : null}

          {pickWindow ? (
            <>
              <AdminThisRoundSection
                openWindow={pickWindow}
                fixtures={openFixtures}
                whatsAppSummary={whatsAppSummary}
                csvContents={csvContents}
              />
              <AdminProxyPicksSection
                players={players}
                fixtures={openFixtures}
                existingSelectionByPlayer={existingSelectionByPlayer}
                window={pickWindow}
                busy={actionId === 'proxy-pick' || actionId === 'late-pick' || actionId === 'manual-player'}
                onCreateManualPlayer={handleCreateManualPlayer}
                onSaveProxyPick={handleSaveProxyPick}
                onSaveLatePick={handleSaveLatePick}
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
