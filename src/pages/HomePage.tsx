import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ButtonLink } from '../components/ButtonLink'
import { FixtureMatchRow } from '../components/FixtureMatchRow'
import { PickDistributionRowView } from '../components/PickDistributionRowView'
import { TeamChip } from '../components/TeamChip'
import { useAuth } from '../contexts/AuthContext'
import { useGame } from '../contexts/GameContext'
import { CURRENT_GAME } from '../lib/constants'
import {
  buildSelectableTeamOptions,
  fetchLatestOperationalWindow,
  fetchWindowEligibleFixtures,
  formatCompactDeadlineLondon,
  type SelectableTeamOption,
} from '../lib/fixtureOps'
import { fetchCurrentGame, fetchMyGameEntry } from '../lib/gameEntries'
import {
  ESSENTIAL_FETCH_TIMEOUT_MS,
  playerFacingLoadError,
  withTimeout,
} from '../lib/homeLoad'
import { buildPickDistribution, type PickDistributionRow } from '../lib/pickDistribution'
import { filterSelectableTeamOptions } from '../lib/pickOptions'
import { PLAYER_COMPLETE_ENTRY_MESSAGE, operationalWindowToRoundLabel } from '../lib/round1'
import {
  fetchFinallyUsedTeamIds,
  fetchMySelection,
  fetchSubmittedTeamIdsForWindow,
  isWindowEditable,
  isWindowLocked,
  saveSelection,
} from '../lib/selections'
import { isSupabaseConfigured } from '../lib/supabase'
import { getTeamIdentity } from '../lib/teamIdentity'
import type { Game, GameEntry, Selection, SelectionWindowEligibleFixture, SelectionWindowWithMeta } from '../types'

export function HomePage() {
  const { user, player, loading: authLoading, configured } = useAuth()
  const { applyGameUpdate } = useGame()
  const [game, setGame] = useState<Game | null>(null)
  const [entry, setEntry] = useState<GameEntry | null>(null)
  const [window, setWindow] = useState<SelectionWindowWithMeta | null>(null)
  const [fixtures, setFixtures] = useState<SelectionWindowEligibleFixture[]>([])
  const [selection, setSelection] = useState<Selection | null>(null)
  const [teamOptions, setTeamOptions] = useState<SelectableTeamOption[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [roundLoading, setRoundLoading] = useState(true)
  const [roundFailed, setRoundFailed] = useState(false)
  const [playerLoading, setPlayerLoading] = useState(false)
  const [picksLoading, setPicksLoading] = useState(false)
  const [distribution, setDistribution] = useState<PickDistributionRow[]>([])
  const [submittedCount, setSubmittedCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showFixtures, setShowFixtures] = useState(false)
  const [showAllPicks, setShowAllPicks] = useState(false)
  const [roundReloadKey, setRoundReloadKey] = useState(0)

  const locked = window ? isWindowLocked(window) : false
  const editable = window ? isWindowEditable(window) : false
  const canPick = Boolean(entry?.paid && entry.status === 'active' && window?.status === 'open' && editable)

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
          const windowFixtures = await fetchWindowEligibleFixtures(liveWindow.id)
          return { currentGame, liveWindow, windowFixtures }
        })(),
        ESSENTIAL_FETCH_TIMEOUT_MS,
      )

      setGame(result.currentGame)
      if (result.currentGame) applyGameUpdate(result.currentGame)
      setWindow(result.liveWindow)
      setFixtures(result.windowFixtures)
      setTeamOptions(buildSelectableTeamOptions(result.windowFixtures))
    } catch (err) {
      console.error('Failed to load current round', err)
      setRoundFailed(true)
      setWindow(null)
      setFixtures([])
      setTeamOptions([])
    } finally {
      setRoundLoading(false)
    }
  }, [configured, applyGameUpdate])

  const loadPlayerPick = useCallback(async () => {
    if (!player || !game || !window || fixtures.length === 0) {
      if (!player) {
        setEntry(null)
        setSelection(null)
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
      const options = filterSelectableTeamOptions(buildSelectableTeamOptions(fixtures), usedTeams)
      setEntry(myEntry)
      setSelection(mySelection)
      setTeamOptions(options)
      setSelectedTeamId(mySelection?.team_id ?? '')
    } catch (err) {
      console.error('Failed to load your pick', err)
      setEntry(null)
      setSelection(null)
    } finally {
      setPlayerLoading(false)
    }
  }, [fixtures, game, player, window])

  const loadDistribution = useCallback(async (windowId: string) => {
    setPicksLoading(true)
    try {
      const teamIds = await fetchSubmittedTeamIdsForWindow(windowId)
      setSubmittedCount(teamIds.length)
      setDistribution(buildPickDistribution(teamIds))
    } catch (err) {
      console.error('Failed to load pick distribution', err)
      setSubmittedCount(0)
      setDistribution([])
    } finally {
      setPicksLoading(false)
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
      setPlayerLoading(false)
      return
    }
    if (!game || !window || fixtures.length === 0) return
    void loadPlayerPick()
  }, [authLoading, fixtures.length, game, loadPlayerPick, player, window])

  useEffect(() => {
    if (!window?.id || roundLoading) return
    void loadDistribution(window.id)
  }, [loadDistribution, roundLoading, window?.id])

  const selectedOption = useMemo(
    () => teamOptions.find((team) => team.team_id === selectedTeamId) ?? null,
    [selectedTeamId, teamOptions],
  )

  async function handleSavePick() {
    if (!window || !selectedTeamId) return

    setSaving(true)
    setSaveError(null)
    setSavedMessage(null)

    try {
      const saved = await saveSelection({ windowId: window.id, teamId: selectedTeamId })
      setSelection(saved)
      setSavedMessage(`Saved: ${selectedOption?.team_name ?? getTeamIdentity(selectedTeamId).shortName}.`)
      void loadDistribution(window.id)
    } catch (err) {
      console.error('Failed to save pick', err)
      setSaveError('Could not save your pick. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const roundLabel = window ? operationalWindowToRoundLabel(window.window_number) : 'This round'
  const roundOpen = Boolean(window && editable && window.status === 'open')
  const statusLabel = !window ? 'Closed' : locked || !roundOpen ? 'Closed' : 'Open'
  const hasCurrentPick = Boolean(selection?.team_id)
  const compactDeadline = window ? formatCompactDeadlineLondon(window.deadline_at) : null
  const selectedIdentity = getTeamIdentity(selectedOption?.team_id ?? selection?.team_id)

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
      <section className="los-home-round">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight">{window ? roundLabel : 'No round yet'}</h1>
          <span className={statusLabel === 'Open' ? 'los-home-status los-home-status-open' : 'los-home-status'}>
            {statusLabel}
          </span>
        </div>
        {window ? (
          <p>
            {compactDeadline}
            <span className="los-home-dot" aria-hidden="true">
              ·
            </span>
            {picksLoading && submittedCount === 0 ? 'Loading picks...' : `${submittedCount} picks`}
          </p>
        ) : (
          <p>Check back when the next round opens.</p>
        )}
      </section>

      <section className="los-home-panel">
        {!user && authLoading ? (
          <p className="text-base text-ink">Checking your sign-in...</p>
        ) : !user ? (
          <div className="grid gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">Choose your team</h2>
              <p className="mt-0.5 text-sm text-muted-ink">Log in to make your pick.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ButtonLink to="/login" className="los-tap-target w-full text-base">
                Log in
              </ButtonLink>
              <ButtonLink to="/signup" variant="secondary" className="los-tap-target w-full text-base">
                Sign up
              </ButtonLink>
            </div>
          </div>
        ) : playerLoading ? (
          <p className="text-base text-ink">Loading your pick...</p>
        ) : !entry?.paid || entry.status !== 'active' ? (
          <div className="grid gap-3">
            <p className="text-sm text-ink">{PLAYER_COMPLETE_ENTRY_MESSAGE}</p>
            <ButtonLink to="/dashboard" className="los-tap-target w-full text-base">
              Open dashboard
            </ButtonLink>
          </div>
        ) : !window ? (
          <p className="text-sm text-muted-ink">There is no live round to pick for yet.</p>
        ) : (
          <div className="grid gap-3">
            {hasCurrentPick ? (
              <div className="los-home-pick">
                <TeamChip teamId={selectedIdentity.teamId} size="lg" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-ink">Your pick</p>
                  <p className="truncate text-base font-semibold text-ink">
                    {selectedOption?.team_name ?? selectedIdentity.shortName}
                  </p>
                  <p className="text-sm text-muted-ink">Change it until {compactDeadline}</p>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-base font-semibold text-ink">Choose your team</h2>
                <p className="mt-0.5 text-sm text-muted-ink">Pick one team to win.</p>
              </div>
            )}

            {saveError ? <div className="los-alert los-alert-error text-sm">{saveError}</div> : null}
            {savedMessage ? <div className="los-alert los-alert-success text-sm">{savedMessage}</div> : null}

            <label className="grid gap-1.5">
              <span className="text-sm font-semibold text-ink">{hasCurrentPick ? 'Change pick' : 'Team'}</span>
              <div className="flex items-center gap-2">
                {selectedTeamId ? <TeamChip teamId={selectedTeamId} size="md" /> : null}
                <select
                  className="los-input los-select-lg min-w-0 flex-1"
                  value={selectedTeamId}
                  disabled={!canPick}
                  onChange={(event) => {
                    setSelectedTeamId(event.target.value)
                    setSavedMessage(null)
                  }}
                >
                  <option value="">{canPick ? 'Select a team' : 'Picking is closed'}</option>
                  {teamOptions.map((team) => (
                    <option key={team.team_id} value={team.team_id}>
                      {team.team_name}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            {canPick ? (
              <button
                type="button"
                disabled={!selectedTeamId || saving}
                onClick={() => void handleSavePick()}
                className="los-btn-primary los-tap-target w-full text-base"
              >
                {saving ? 'Saving…' : hasCurrentPick ? 'Update pick' : 'Save pick'}
              </button>
            ) : (
              <p className="text-sm text-muted-ink">
                {locked ? 'The deadline has passed.' : 'Picking is not open yet.'}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="los-home-panel">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Most picked</h2>
          <Link to="/current-picks" className="text-sm font-semibold text-purple">
            See everyone's picks
          </Link>
        </div>
        {picksLoading && distribution.length === 0 ? (
          <p className="mt-2 text-sm text-muted-ink">Loading picks...</p>
        ) : distribution.length === 0 ? (
          <p className="mt-2 text-sm text-muted-ink">No picks yet.</p>
        ) : (
          <>
            <ul className="mt-2 grid gap-2.5">
              {distribution.slice(0, 3).map((row) => (
                <PickDistributionRowView key={row.teamId} row={row} compact />
              ))}
            </ul>
            <button type="button" className="los-home-ghost" onClick={() => setShowAllPicks((open) => !open)}>
              {showAllPicks ? 'Hide all picks' : 'View all picks'}
            </button>
            {showAllPicks ? (
              <ul className="mt-1 grid gap-3">
                {distribution.map((row) => (
                  <PickDistributionRowView key={`all-${row.teamId}`} row={row} />
                ))}
              </ul>
            ) : null}
          </>
        )}
      </section>

      <section className="los-home-panel">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">
            {fixtures.length} fixture{fixtures.length === 1 ? '' : 's'} this week
          </h2>
          <button type="button" className="los-home-ghost los-home-ghost-inline" onClick={() => setShowFixtures((open) => !open)}>
            {showFixtures ? 'Hide' : 'Show'}
          </button>
        </div>
        {showFixtures ? (
          fixtures.length === 0 ? (
            <p className="mt-2 text-sm text-muted-ink">No fixtures to show yet.</p>
          ) : (
            <ul className="mt-1">
              {fixtures.map((fixture) => (
                <FixtureMatchRow key={fixture.id} fixture={fixture} />
              ))}
            </ul>
          )
        ) : null}
      </section>

      <p className="text-center text-xs text-white/65">Game {game?.game_number ?? CURRENT_GAME}</p>
    </div>
  )
}
