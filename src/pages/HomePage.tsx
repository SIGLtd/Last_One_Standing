import { useCallback, useEffect, useMemo, useState } from 'react'
import { ButtonLink } from '../components/ButtonLink'
import { Card } from '../components/Card'
import { useAuth } from '../contexts/AuthContext'
import { CURRENT_GAME } from '../lib/constants'
import {
  buildSelectableTeamOptions,
  fetchLatestOperationalWindow,
  fetchWindowEligibleFixtures,
  formatDeadlineLondon,
  type SelectableTeamOption,
} from '../lib/fixtureOps'
import { fetchCurrentGame, fetchMyGameEntry } from '../lib/gameEntries'
import { buildPickDistribution, formatPickDistributionLine, type PickDistributionRow } from '../lib/pickDistribution'
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
import type { Game, GameEntry, Selection, SelectionWindowEligibleFixture, SelectionWindowWithMeta } from '../types'

function formatFixtureWhen(iso: string): string {
  const date = new Date(iso)
  const weekday = date.toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'short' })
  const day = date.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric' })
  const month = date.toLocaleDateString('en-GB', { timeZone: 'Europe/London', month: 'short' })
  const time = date.toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${weekday} ${day} ${month}, ${time}`
}

function formatSavedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function HomePage() {
  const { user, player, loading: authLoading, configured } = useAuth()
  const [game, setGame] = useState<Game | null>(null)
  const [entry, setEntry] = useState<GameEntry | null>(null)
  const [window, setWindow] = useState<SelectionWindowWithMeta | null>(null)
  const [fixtures, setFixtures] = useState<SelectionWindowEligibleFixture[]>([])
  const [selection, setSelection] = useState<Selection | null>(null)
  const [teamOptions, setTeamOptions] = useState<SelectableTeamOption[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [coreLoading, setCoreLoading] = useState(true)
  const [picksLoading, setPicksLoading] = useState(false)
  const [distribution, setDistribution] = useState<PickDistributionRow[]>([])
  const [submittedCount, setSubmittedCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  const locked = window ? isWindowLocked(window) : false
  const editable = window ? isWindowEditable(window) : false
  const canPick = Boolean(entry?.paid && entry.status === 'active' && window?.status === 'open' && editable)

  const loadCore = useCallback(async () => {
    if (!configured || !isSupabaseConfigured) {
      setCoreLoading(false)
      return
    }

    setCoreLoading(true)
    setPageError(null)

    try {
      const currentGame = await fetchCurrentGame()
      setGame(currentGame)

      if (!currentGame) {
        setWindow(null)
        setFixtures([])
        setEntry(null)
        setSelection(null)
        setTeamOptions([])
        return
      }

      const liveWindow = await fetchLatestOperationalWindow(currentGame.id)
      setWindow(liveWindow)

      if (!liveWindow) {
        setFixtures([])
        setTeamOptions([])
        setSelection(null)
        if (player) {
          const myEntry = await fetchMyGameEntry(player.id, currentGame.id)
          setEntry(myEntry)
        } else {
          setEntry(null)
        }
        return
      }

      const fixturePromise = fetchWindowEligibleFixtures(liveWindow.id)
      const playerPromise = player
        ? Promise.all([
            fetchMyGameEntry(player.id, currentGame.id),
            fetchMySelection(player.id, currentGame.id, liveWindow.id),
            fetchFinallyUsedTeamIds(player.id, currentGame.id),
          ])
        : Promise.resolve(null)

      const [windowFixtures, playerData] = await Promise.all([fixturePromise, playerPromise])
      const options = buildSelectableTeamOptions(windowFixtures)

      setFixtures(windowFixtures)

      if (playerData) {
        const [myEntry, mySelection, usedTeams] = playerData
        setEntry(myEntry)
        setSelection(mySelection)
        setTeamOptions(filterSelectableTeamOptions(options, usedTeams))
        setSelectedTeamId(mySelection?.team_id ?? '')
      } else {
        setEntry(null)
        setSelection(null)
        setTeamOptions(options)
        setSelectedTeamId('')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load the current round.'
      setPageError(message)
    } finally {
      setCoreLoading(false)
    }
  }, [configured, player])

  const loadDistribution = useCallback(async (windowId: string) => {
    setPicksLoading(true)
    try {
      const teamIds = await fetchSubmittedTeamIdsForWindow(windowId)
      setSubmittedCount(teamIds.length)
      setDistribution(buildPickDistribution(teamIds))
    } catch {
      setSubmittedCount(0)
      setDistribution([])
    } finally {
      setPicksLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading) void loadCore()
  }, [authLoading, loadCore])

  useEffect(() => {
    if (!window?.id || coreLoading) return
    void loadDistribution(window.id)
  }, [coreLoading, loadDistribution, window?.id])

  const selectedOption = useMemo(
    () => teamOptions.find((team) => team.team_id === selectedTeamId) ?? null,
    [selectedTeamId, teamOptions],
  )

  async function handleSavePick() {
    if (!window || !selectedTeamId) return

    setSaving(true)
    setPageError(null)
    setSavedMessage(null)

    try {
      const saved = await saveSelection({ windowId: window.id, teamId: selectedTeamId })
      setSelection(saved)
      setSavedMessage(`Saved: ${selectedOption?.team_name ?? 'your pick'}.`)
      void loadDistribution(window.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save your pick.'
      setPageError(message)
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || coreLoading) {
    return (
      <Card title="Last One Standing" compact>
        <p className="text-base text-ink">Loading your game...</p>
      </Card>
    )
  }

  const roundLabel = window ? operationalWindowToRoundLabel(window.window_number) : 'This round'
  const roundOpen = Boolean(window && editable && window.status === 'open')
  const statusLabel = !window ? 'Closed' : locked || !roundOpen ? 'Closed' : 'Open'
  const hasCurrentPick = Boolean(selection?.team_id)

  return (
    <div className="grid gap-3">
      <Card
        title={window ? `${roundLabel} is ${statusLabel.toLowerCase()}` : 'No round is open yet'}
        right={
          <span className={statusLabel === 'Open' ? 'los-badge los-badge-open text-sm' : 'los-badge los-badge-muted text-sm'}>
            {statusLabel}
          </span>
        }
        compact
      >
        <div className="grid gap-2 text-base text-ink">
          {window ? (
            <>
              <p>
                <strong>Deadline:</strong> {formatDeadlineLondon(window.deadline_at)}
              </p>
              <p>
                <strong>Picks submitted:</strong> {picksLoading ? 'Loading picks...' : submittedCount}
              </p>
              <p className="text-muted-ink">
                Pick one team to win. You can change it until the deadline.
              </p>
            </>
          ) : (
            <p className="text-muted-ink">Check back when the organiser opens the next round.</p>
          )}
        </div>
      </Card>

      <Card title={hasCurrentPick ? 'Your pick' : 'Choose your team'} compact>
        {!user ? (
          <div className="grid gap-3">
            <p className="text-base text-ink">Log in to choose your team.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <ButtonLink to="/login" className="los-tap-target w-full text-base">
                Log in
              </ButtonLink>
              <ButtonLink to="/signup" variant="secondary" className="los-tap-target w-full text-base">
                Sign up
              </ButtonLink>
            </div>
          </div>
        ) : !entry?.paid || entry.status !== 'active' ? (
          <div className="grid gap-3">
            <p className="text-base text-ink">{PLAYER_COMPLETE_ENTRY_MESSAGE}</p>
            <ButtonLink to="/dashboard" className="los-tap-target w-full text-base">
              Open dashboard
            </ButtonLink>
          </div>
        ) : !window ? (
          <p className="text-base text-muted-ink">There is no live round to pick for yet.</p>
        ) : (
          <div className="grid gap-3">
            {hasCurrentPick ? (
              <div className="rounded border border-border bg-white p-3">
                <p className="text-lg font-semibold text-ink">
                  {selectedOption?.team_name ?? selection?.team_id}
                </p>
                {selectedOption ? (
                  <p className="mt-1 text-sm text-muted-ink">
                    {selectedOption.venue} vs {selectedOption.opponent_name}
                  </p>
                ) : null}
                {selection?.updated_at ? (
                  <p className="mt-1 text-sm text-muted-ink">Saved {formatSavedAt(selection.updated_at)}</p>
                ) : null}
              </div>
            ) : null}

            {pageError ? <div className="los-alert los-alert-error text-sm">{pageError}</div> : null}
            {savedMessage ? <div className="los-alert los-alert-success text-sm">{savedMessage}</div> : null}

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-ink">
                {hasCurrentPick ? 'Change pick' : 'Choose your team'}
              </span>
              <select
                className="los-input los-select-lg"
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
                {locked ? 'The deadline has passed. You can no longer change this pick.' : 'Picking is not open yet.'}
              </p>
            )}
          </div>
        )}
      </Card>

      <Card title="This week’s fixtures" compact>
        {fixtures.length === 0 ? (
          <p className="text-base text-muted-ink">No fixtures to show yet.</p>
        ) : (
          <ul className="grid gap-2">
            {fixtures.map((fixture) => (
              <li key={fixture.id} className="rounded border border-border px-3 py-2">
                <p className="text-sm text-muted-ink">{formatFixtureWhen(fixture.kickoff_at)}</p>
                <p className="text-base font-medium text-ink">
                  {fixture.home_team_name} v {fixture.away_team_name}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="What everyone is picking" compact>
        {picksLoading ? (
          <p className="text-base text-ink">Loading picks...</p>
        ) : distribution.length === 0 ? (
          <p className="text-base text-muted-ink">No picks submitted yet.</p>
        ) : (
          <ul className="grid gap-3">
            {distribution.map((row) => (
              <li key={row.teamId}>
                <p className="text-base text-ink">{formatPickDistributionLine(row)}</p>
                <div className="los-pick-bar mt-1" aria-hidden="true">
                  <span style={{ width: `${row.percent}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-center text-sm text-muted-ink">Game {game?.game_number ?? CURRENT_GAME}</p>
    </div>
  )
}
