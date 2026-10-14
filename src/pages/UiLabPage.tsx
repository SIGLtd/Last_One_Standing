import { useCallback, useEffect, useMemo, useState } from 'react'
import { ButtonLink } from '../components/ButtonLink'
import { Card } from '../components/Card'
import { AdminCockpitPreview } from '../components/ui-lab/AdminCockpitPreview'
import { CurrentPicksPreview } from '../components/ui-lab/CurrentPicksPreview'
import { HistoryPreview } from '../components/ui-lab/HistoryPreview'
import { PickPreview } from '../components/ui-lab/PickPreview'
import { PlayerHomePreview } from '../components/ui-lab/PlayerHomePreview'
import { PreviewShell } from '../components/ui-lab/PreviewShell'
import { RulesPreview } from '../components/ui-lab/RulesPreview'
import { HISTORY_GAMES_1_TO_27 } from '../config/history'
import { useAuth } from '../contexts/AuthContext'
import { canAccessUiLab, uiLabBlockedCopy } from '../lib/uiLabAccess'
import {
  fetchLatestOperationalWindow,
  fetchLatestResolvedOperationalWindow,
  fetchPlayerFacingWindowFixtures,
  formatCompactDeadlineLondon,
} from '../lib/fixtureOps'
import { adminFetchGameEntries, fetchCurrentGame, fetchGames, fetchMyGameEntry } from '../lib/gameEntries'
import { mergeHistoryWithLiveGames } from '../lib/gameLifecycle'
import { buildPickDistribution } from '../lib/pickDistribution'
import { operationalWindowToRoundLabel } from '../lib/round1'
import {
  fetchCurrentWindowPicks,
  fetchFinallyUsedTeamIds,
  fetchMySelection,
} from '../lib/selections'
import { isSupabaseConfigured } from '../lib/supabase'
import { buildHomeSurvivorRows } from '../lib/survivalStatus'
import { getTeamIdentity } from '../lib/teamIdentity'
import {
  buildAdminOverview,
  buildPlayerHomePreview,
  type PreviewPersona,
  type UiLabScreen,
  withReinstatedUsedTeams,
} from '../lib/uiLabPreview'
import type {
  Game,
  GameEntry,
  GameEntryWithPlayer,
  Selection,
  SelectionWindowEligibleFixture,
  SelectionWindowWithMeta,
  WindowPickRow,
} from '../types'

export function UiLabPage() {
  const { user, player, loading } = useAuth()
  const access = canAccessUiLab({
    authLoading: loading,
    isAuthenticated: Boolean(user),
    isAdmin: Boolean(player?.is_admin),
  })
  const blocked = uiLabBlockedCopy(access)

  const [screen, setScreen] = useState<UiLabScreen>('player-home')
  const [persona, setPersona] = useState<PreviewPersona>('live')
  const [pageLoading, setPageLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [window, setWindow] = useState<SelectionWindowWithMeta | null>(null)
  const [fixtures, setFixtures] = useState<SelectionWindowEligibleFixture[]>([])
  const [picks, setPicks] = useState<WindowPickRow[]>([])
  const [entry, setEntry] = useState<GameEntry | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [usedTeamIds, setUsedTeamIds] = useState<string[]>([])
  const [entries, setEntries] = useState<GameEntryWithPlayer[]>([])
  const [liveGames, setLiveGames] = useState<Game[]>([])
  const [survivors, setSurvivors] = useState<ReturnType<typeof buildHomeSurvivorRows>>([])
  const [survivorRoundLabel, setSurvivorRoundLabel] = useState<string | null>(null)

  const loadLab = useCallback(async () => {
    if (access !== 'allowed' || !isSupabaseConfigured) {
      setPageLoading(false)
      return
    }

    setPageLoading(true)
    setPageError(null)

    try {
      const currentGame = await fetchCurrentGame()
      setGame(currentGame)

      if (!currentGame) {
        setWindow(null)
        setFixtures([])
        setPicks([])
        setEntry(null)
        setSelection(null)
        setUsedTeamIds([])
        setEntries([])
        return
      }

      const [liveWindow, games, gameEntries] = await Promise.all([
        fetchLatestOperationalWindow(currentGame.id),
        fetchGames(),
        adminFetchGameEntries(currentGame.id),
      ])

      setLiveGames(games)
      setEntries(gameEntries)
      setWindow(liveWindow)

      if (liveWindow) {
        const [windowFixtures, windowPicks] = await Promise.all([
          fetchPlayerFacingWindowFixtures(liveWindow.id),
          fetchCurrentWindowPicks(currentGame.id, liveWindow.id),
        ])
        setFixtures(windowFixtures)
        setPicks(windowPicks.sort((a, b) => a.display_name.localeCompare(b.display_name)))
      } else {
        setFixtures([])
        setPicks([])
      }

      if (player) {
        const [myEntry, mySelection, used] = await Promise.all([
          fetchMyGameEntry(player.id, currentGame.id),
          liveWindow ? fetchMySelection(player.id, currentGame.id, liveWindow.id) : Promise.resolve(null),
          fetchFinallyUsedTeamIds(player.id, currentGame.id),
        ])
        setEntry(myEntry)
        setSelection(mySelection)
        setUsedTeamIds(used)
      }

      const resolvedWindow = await fetchLatestResolvedOperationalWindow(currentGame.id)
      if (resolvedWindow) {
        const resolvedPicks = await fetchCurrentWindowPicks(currentGame.id, resolvedWindow.id)
        setSurvivorRoundLabel(operationalWindowToRoundLabel(resolvedWindow.window_number))
        setSurvivors(buildHomeSurvivorRows(resolvedPicks))
      } else {
        setSurvivorRoundLabel(null)
        setSurvivors([])
      }
    } catch (err) {
      console.error('Failed to load UI Lab', err)
      setPageError('Could not load live preview data.')
    } finally {
      setPageLoading(false)
    }
  }, [access, player])

  useEffect(() => {
    void loadLab()
  }, [loadLab])

  const paidActive = entries.filter((row) => row.paid && row.status === 'active')
  const submittedCount = picks.filter((row) => Boolean(row.team_id)).length
  const unpickedCount = Math.max(paidActive.length - submittedCount, 0)
  const roundLabel = window ? operationalWindowToRoundLabel(window.window_number) : 'No round yet'
  const deadlineLabel = window ? formatCompactDeadlineLondon(window.deadline_at) : 'No deadline set'
  const displayUsedTeamIds = persona === 'reinstated' ? withReinstatedUsedTeams(usedTeamIds) : usedTeamIds
  const distribution = useMemo(
    () => buildPickDistribution(picks.map((row) => row.team_id)),
    [picks],
  )
  const history = useMemo(() => mergeHistoryWithLiveGames(HISTORY_GAMES_1_TO_27, liveGames), [liveGames])

  const homeModel = buildPlayerHomePreview({
    persona,
    gameNumber: game?.game_number ?? null,
    currentPot: game?.current_pot ?? null,
    roundLabel,
    deadlineAt: window?.deadline_at ?? null,
    liveEntryStatus: entry?.status,
    gameStatus: game?.status,
    hasCurrentPick: Boolean(selection?.team_id),
    currentPickName: selection?.team_id ? getTeamIdentity(selection.team_id).shortName : null,
    usedTeamIds: displayUsedTeamIds,
    survivorCount: paidActive.length,
  })

  const overview = buildAdminOverview({
    gameNumber: game?.game_number ?? null,
    currentPot: game?.current_pot ?? null,
    windowNumber: window?.window_number ?? null,
    deadlineAt: window?.deadline_at ?? null,
    windowStatus: window?.status ?? null,
    gameStatus: game?.status ?? null,
    survivorCount: paidActive.length,
    picksSubmitted: submittedCount,
    paidActiveCount: paidActive.length,
    unpickedCount,
  })

  if (access === 'loading') {
    return (
      <Card title="UI Lab" description="Checking access" compact>
        <p className="text-sm text-muted-ink">Please wait.</p>
      </Card>
    )
  }

  if (blocked) {
    return (
      <Card title="UI Lab" description="Access denied" compact>
        <p className="mb-3 text-sm text-muted-ink">{blocked}</p>
        <ButtonLink to="/" variant="secondary">
          Back to Home
        </ButtonLink>
      </Card>
    )
  }

  if (pageLoading && !game) {
    return (
      <Card title="UI Lab" description="Loading live preview data" compact>
        <p className="text-sm text-muted-ink">Please wait.</p>
      </Card>
    )
  }

  return (
    <PreviewShell screen={screen} onScreenChange={setScreen}>
      {pageError ? <div className="los-alert los-alert-error text-sm">{pageError}</div> : null}

      {screen === 'player-home' ? (
        <PlayerHomePreview
          model={homeModel}
          persona={persona}
          onPersonaChange={setPersona}
          pot={game?.current_pot ?? 0}
          survivorCount={paidActive.length}
          paidCount={entries.filter((row) => row.paid).length}
          submittedCount={submittedCount}
          distribution={distribution}
          fixtures={fixtures}
          survivors={survivors}
          survivorRoundLabel={survivorRoundLabel}
        />
      ) : null}

      {screen === 'make-pick' ? (
        <PickPreview
          roundLabel={roundLabel}
          deadlineLabel={deadlineLabel}
          spectator={homeModel.spectator}
          persona={persona === 'complete' ? 'live' : persona}
          onPersonaChange={setPersona}
          fixtures={fixtures}
          usedTeamIds={displayUsedTeamIds}
        />
      ) : null}

      {screen === 'everyones-picks' ? (
        <CurrentPicksPreview roundLabel={roundLabel} window={window} rows={picks} />
      ) : null}

      {screen === 'history' ? <HistoryPreview history={history} /> : null}

      {screen === 'rules' ? <RulesPreview /> : null}

      {screen === 'admin-cockpit' ? (
        <AdminCockpitPreview
          overview={overview}
          windowStatus={window?.status ?? null}
          gameStatus={game?.status ?? null}
          survivorCount={paidActive.length}
        />
      ) : null}
    </PreviewShell>
  )
}
