import { useCallback, useEffect, useState } from 'react'
import { PlayerHomePreview } from '../components/ui-lab/PlayerHomePreview'
import { useAuth } from '../contexts/AuthContext'
import { useGame } from '../contexts/GameContext'
import { homeCompletionView, isCompletedGame } from '../lib/gameLifecycle'
import {
  fetchLatestOperationalWindow,
  fetchLatestResolvedOperationalWindow,
  fetchPlayerFacingWindowFixtures,
} from '../lib/fixtureOps'
import { fetchCurrentGame, fetchMyGameEntry } from '../lib/gameEntries'
import { ESSENTIAL_FETCH_TIMEOUT_MS, playerFacingLoadError, withTimeout } from '../lib/homeLoad'
import { buildPickDistribution, type PickDistributionRow } from '../lib/pickDistribution'
import { operationalWindowToRoundLabel } from '../lib/round1'
import {
  fetchCurrentWindowPicks,
  fetchFinallyUsedTeamIds,
  fetchMySelection,
} from '../lib/selections'
import { buildHomeSurvivorRows, type HomeSurvivorRow } from '../lib/survivalStatus'
import { isSupabaseConfigured } from '../lib/supabase'
import { getTeamIdentity } from '../lib/teamIdentity'
import { buildPlayerHomePreview } from '../lib/uiLabPreview'
import type { Game, GameEntry, Selection, SelectionWindowEligibleFixture, SelectionWindowWithMeta } from '../types'

export function HomePage() {
  const { user, player, loading: authLoading, configured } = useAuth()
  const { applyGameUpdate } = useGame()
  const [game, setGame] = useState<Game | null>(null)
  const [entry, setEntry] = useState<GameEntry | null>(null)
  const [window, setWindow] = useState<SelectionWindowWithMeta | null>(null)
  const [fixtures, setFixtures] = useState<SelectionWindowEligibleFixture[]>([])
  const [selection, setSelection] = useState<Selection | null>(null)
  const [usedTeamIds, setUsedTeamIds] = useState<string[]>([])
  const [roundLoading, setRoundLoading] = useState(true)
  const [roundFailed, setRoundFailed] = useState(false)
  const [playerLoading, setPlayerLoading] = useState(false)
  const [picksLoading, setPicksLoading] = useState(false)
  const [distribution, setDistribution] = useState<PickDistributionRow[]>([])
  const [submittedCount, setSubmittedCount] = useState(0)
  const [activeCount, setActiveCount] = useState(0)
  const [fieldCount, setFieldCount] = useState(0)
  const [showAllPicks, setShowAllPicks] = useState(false)
  const [roundReloadKey, setRoundReloadKey] = useState(0)
  const [survivors, setSurvivors] = useState<HomeSurvivorRow[]>([])
  const [survivorRoundLabel, setSurvivorRoundLabel] = useState<string | null>(null)

  const loadRound = useCallback(async () => {
    if (!configured || !isSupabaseConfigured) {
      setRoundLoading(false)
      setRoundFailed(false)
      return
    }

    setRoundLoading(true)
    setRoundFailed(false)

    try {
      const result = await withTimeout(
        (async () => {
          const currentGame = await fetchCurrentGame()
          if (!currentGame) {
            return { currentGame: null, liveWindow: null, windowFixtures: [] as SelectionWindowEligibleFixture[] }
          }
          const liveWindow = await fetchLatestOperationalWindow(currentGame.id)
          if (!liveWindow) {
            return { currentGame, liveWindow: null, windowFixtures: [] as SelectionWindowEligibleFixture[] }
          }
          const windowFixtures = await fetchPlayerFacingWindowFixtures(liveWindow.id)
          return { currentGame, liveWindow, windowFixtures }
        })(),
        ESSENTIAL_FETCH_TIMEOUT_MS,
      )

      setGame(result.currentGame)
      if (result.currentGame) applyGameUpdate(result.currentGame)
      setWindow(result.liveWindow)
      setFixtures(result.windowFixtures)
    } catch (err) {
      console.error('Failed to load current round', err)
      setRoundFailed(true)
      setWindow(null)
      setFixtures([])
    } finally {
      setRoundLoading(false)
    }
  }, [configured, applyGameUpdate])

  const loadPlayerPick = useCallback(async () => {
    if (!player || !game || !window) {
      if (!player) {
        setEntry(null)
        setSelection(null)
        setUsedTeamIds([])
        setPlayerLoading(false)
      }
      return
    }

    setPlayerLoading(true)
    try {
      const [myEntry, mySelection, usedTeams] = await Promise.all([
        fetchMyGameEntry(player.id, game.id),
        fetchMySelection(player.id, game.id, window.id),
        fetchFinallyUsedTeamIds(player.id, game.id),
      ])
      setEntry(myEntry)
      setSelection(mySelection)
      setUsedTeamIds(usedTeams)
    } catch (err) {
      console.error('Failed to load your pick', err)
      setEntry(null)
      setSelection(null)
    } finally {
      setPlayerLoading(false)
    }
  }, [game, player, window])

  const loadDistribution = useCallback(async (gameId: string, windowId: string) => {
    setPicksLoading(true)
    try {
      const picks = await fetchCurrentWindowPicks(gameId, windowId)
      setSubmittedCount(picks.filter((row) => Boolean(row.team_id)).length)
      setActiveCount(picks.filter((row) => row.entry_status === 'active').length)
      setFieldCount(picks.length)
      setDistribution(buildPickDistribution(picks.map((row) => row.team_id)))
    } catch (err) {
      console.error('Failed to load pick distribution', err)
      setSubmittedCount(0)
      setActiveCount(0)
      setFieldCount(0)
      setDistribution([])
    } finally {
      setPicksLoading(false)
    }
  }, [])

  const loadSurvivors = useCallback(async (gameId: string) => {
    try {
      const resolvedWindow = await fetchLatestResolvedOperationalWindow(gameId)
      if (!resolvedWindow) {
        setSurvivors([])
        setSurvivorRoundLabel(null)
        return
      }
      const picks = await fetchCurrentWindowPicks(gameId, resolvedWindow.id)
      setSurvivorRoundLabel(operationalWindowToRoundLabel(resolvedWindow.window_number))
      setSurvivors(buildHomeSurvivorRows(picks))
    } catch (err) {
      console.error('Failed to load survivors', err)
      setSurvivors([])
      setSurvivorRoundLabel(null)
    }
  }, [])

  useEffect(() => {
    void loadRound()
  }, [loadRound, roundReloadKey])

  useEffect(() => {
    if (authLoading) return
    if (!player) {
      setEntry(null)
      setSelection(null)
      setUsedTeamIds([])
      setPlayerLoading(false)
      return
    }
    if (!game || !window) return
    void loadPlayerPick()
  }, [authLoading, game, loadPlayerPick, player, window])

  useEffect(() => {
    if (!game?.id || !window?.id || roundLoading) return
    void loadDistribution(game.id, window.id)
  }, [game?.id, loadDistribution, roundLoading, window?.id])

  useEffect(() => {
    if (!game?.id || roundLoading || isCompletedGame(game)) {
      if (isCompletedGame(game)) {
        setSurvivors([])
        setSurvivorRoundLabel(null)
      }
      return
    }
    void loadSurvivors(game.id)
  }, [game, loadSurvivors, roundLoading])

  const completion = game ? homeCompletionView(game) : null
  const gameFinished = isCompletedGame(game)
  const roundLabel = window ? operationalWindowToRoundLabel(window.window_number) : 'No round yet'
  const model = buildPlayerHomePreview({
    persona: 'live',
    gameNumber: game?.game_number ?? null,
    currentPot: game?.current_pot ?? null,
    roundLabel,
    deadlineAt: window?.deadline_at ?? null,
    liveEntryStatus: entry?.status,
    gameStatus: game?.status,
    hasCurrentPick: Boolean(selection?.team_id),
    currentPickName: selection?.team_id ? getTeamIdentity(selection.team_id).shortName : null,
    currentPickTeamId: selection?.team_id ?? null,
    usedTeamIds,
    survivorCount: activeCount || survivors.length,
    isGuest: !authLoading && !user,
    paid: entry?.paid,
    winnerName: game?.winner_display_name ?? null,
    prizeAmount: game?.prize_paid_amount ?? game?.rollover_amount ?? game?.current_pot ?? null,
    completionKind: completion?.kind ?? null,
  })

  if (roundLoading && !window) {
    return (
      <section className="los-home-panel los-home-loading">
        <p className="text-base font-semibold text-ink">Loading your game...</p>
        <p className="text-sm text-muted-ink">Current round</p>
      </section>
    )
  }

  if (roundFailed) {
    return (
      <section className="los-home-panel los-home-loading">
        <h2 className="text-base font-semibold text-ink">Could not load the current round</h2>
        <p className="mt-1 text-sm text-muted-ink">{playerFacingLoadError()}</p>
        <button
          type="button"
          className="los-btn-primary los-tap-target mt-3 w-full text-base"
          onClick={() => setRoundReloadKey((key) => key + 1)}
        >
          Retry
        </button>
      </section>
    )
  }

  return (
    <div className="los-home">
      {authLoading && !user ? <p className="text-base text-ink">Checking your sign-in...</p> : null}
      {playerLoading ? <p className="text-sm text-muted-ink">Loading your pick...</p> : null}
      {picksLoading && submittedCount === 0 ? <p className="text-sm text-muted-ink">Loading picks...</p> : null}
      <PlayerHomePreview
        model={model}
        pot={game?.current_pot ?? 0}
        survivorCount={activeCount || survivors.length}
        paidCount={fieldCount}
        submittedCount={submittedCount}
        distribution={distribution}
        fixtures={fixtures}
        survivors={gameFinished ? [] : survivors}
        survivorRoundLabel={gameFinished ? null : survivorRoundLabel}
        live
        showAllPicks={showAllPicks}
        onToggleAllPicks={() => setShowAllPicks((open) => !open)}
      />
      <p className="text-center text-xs text-white/65">Game {game?.game_number ?? ''}</p>
    </div>
  )
}
