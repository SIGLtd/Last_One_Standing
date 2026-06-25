import { useCallback, useEffect, useMemo, useState } from 'react'
import { ButtonLink } from '../components/ButtonLink'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { MetricCell, MetricStrip } from '../components/MetricCell'
import { useAuth } from '../contexts/AuthContext'
import { CURRENT_GAME } from '../lib/constants'
import {
  buildSelectableTeamOptions,
  fetchOpenSelectionWindow,
  fetchPlannedOperationalWindow,
  fetchWindowEligibleFixtures,
  formatLondonDateTime,
} from '../lib/fixtureOps'
import { WINDOW2_UPCOMING_PLAYER_MESSAGE } from '../lib/window2Draft'
import { fetchCurrentGame, fetchMyGameEntry } from '../lib/gameEntries'
import {
  fetchFinallyUsedTeamIds,
  fetchMySelection,
  isWindowEditable,
  isWindowLocked,
  saveSelection,
} from '../lib/selections'
import type { Game, GameEntry, Selection, SelectionWindowWithMeta } from '../types'

export function PickPage() {
  const { user, player, loading: authLoading, configured } = useAuth()
  const [game, setGame] = useState<Game | null>(null)
  const [entry, setEntry] = useState<GameEntry | null>(null)
  const [window, setWindow] = useState<SelectionWindowWithMeta | null>(null)
  const [plannedWindow, setPlannedWindow] = useState<SelectionWindowWithMeta | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [usedTeamIds, setUsedTeamIds] = useState<string[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [teamOptions, setTeamOptions] = useState<ReturnType<typeof buildSelectableTeamOptions>>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  const locked = window ? isWindowLocked(window) : false
  const editable = window ? isWindowEditable(window) : false
  const canPick = Boolean(entry?.paid && entry.status === 'active' && window?.status === 'open' && editable)

  const loadPickPage = useCallback(async () => {
    if (!player || !configured) {
      setPageLoading(false)
      return
    }

    setPageLoading(true)
    setPageError(null)

    try {
      const currentGame = await fetchCurrentGame()
      setGame(currentGame)

      if (!currentGame) {
        setEntry(null)
        setWindow(null)
        setPlannedWindow(null)
        setSelection(null)
        setTeamOptions([])
        return
      }

      const [myEntry, openWindow, pendingWindow] = await Promise.all([
        fetchMyGameEntry(player.id, currentGame.id),
        fetchOpenSelectionWindow(currentGame.id),
        fetchPlannedOperationalWindow(currentGame.id),
      ])

      setEntry(myEntry)
      setWindow(openWindow)
      setPlannedWindow(pendingWindow)

      if (openWindow) {
        const [fixtures, mySelection, usedTeams] = await Promise.all([
          fetchWindowEligibleFixtures(openWindow.id),
          fetchMySelection(player.id, currentGame.id, openWindow.id),
          fetchFinallyUsedTeamIds(player.id, currentGame.id),
        ])

        setTeamOptions(buildSelectableTeamOptions(fixtures))
        setSelection(mySelection)
        setUsedTeamIds(usedTeams)
        setSelectedTeamId(mySelection?.team_id ?? null)
      } else {
        setTeamOptions([])
        setSelection(null)
        setUsedTeamIds([])
        setSelectedTeamId(null)
        setPlannedWindow(null)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load pick page.'
      setPageError(message)
    } finally {
      setPageLoading(false)
    }
  }, [configured, player])

  useEffect(() => {
    if (!authLoading) void loadPickPage()
  }, [authLoading, loadPickPage])

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
      setSavedMessage(`Saved ${selectedOption?.team_name ?? 'pick'} for window ${window.window_number}.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save pick.'
      setPageError(message)
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || pageLoading) {
    return (
      <Card title="Make your pick" description="Loading…" compact>
        <p className="text-xs text-muted-ink">Please wait.</p>
      </Card>
    )
  }

  if (!user) {
    return (
      <Card title="Make your pick" description="Login required" compact>
        <p className="text-xs text-muted-ink mb-2">Log in or sign up to make your pick.</p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/login">Log in</ButtonLink>
          <ButtonLink to="/signup" variant="secondary">
            Sign up
          </ButtonLink>
        </div>
      </Card>
    )
  }

  if (!entry?.paid || entry.status !== 'active') {
    return (
      <Card title="Make your pick" description={`Game ${CURRENT_GAME}`} compact>
        <p className="text-xs text-muted-ink">Verified entry required before making a pick.</p>
      </Card>
    )
  }

  if (!window) {
    return (
      <Card title="Make your pick" description={`Game ${CURRENT_GAME}`} compact>
        {plannedWindow ? (
          <div className="los-notice text-xs">{WINDOW2_UPCOMING_PLAYER_MESSAGE}</div>
        ) : (
          <p className="text-xs text-muted-ink">No open selection window is available yet.</p>
        )}
      </Card>
    )
  }

  return (
    <Card
      title="Make your pick"
      description={`Game ${game?.game_number ?? CURRENT_GAME} · Window ${window.window_number}`}
      right={<Badge variant={locked ? 'muted' : 'open'}>{locked ? 'Locked' : 'Open'}</Badge>}
      compact
    >
      <div className="grid gap-2">
        <MetricStrip>
          <MetricCell label="Deadline" value={formatLondonDateTime(window.deadline_at)} />
          <MetricCell label="Selected" value={selectedOption?.team_name ?? '—'} />
          <MetricCell
            label="Weekend"
            value={
              window.eligible_sat_date && window.eligible_sun_date
                ? `${window.eligible_sat_date} – ${window.eligible_sun_date}`
                : '—'
            }
          />
        </MetricStrip>

        {pageError ? <div className="los-alert los-alert-error">{pageError}</div> : null}
        {savedMessage ? <div className="los-alert los-alert-success">{savedMessage}</div> : null}

        <p className="text-xs text-muted-ink">
          Choose a team from the approved Saturday and Sunday fixtures for this window.
        </p>

        <div className="grid gap-1">
          {teamOptions.map((team) => {
            const isUsed = usedTeamIds.includes(team.team_id)
            const isSelected = selectedTeamId === team.team_id
            const disabled = !canPick || locked || (isUsed && !isSelected)

            return (
              <button
                key={team.team_id}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedTeamId(team.team_id)}
                className={[
                  'los-fixture-tile !flex !flex-col !items-start !gap-0.5 !h-auto !py-2',
                  disabled ? 'los-fixture-tile-used cursor-not-allowed' : 'cursor-pointer',
                  isSelected ? 'los-fixture-tile-selected' : '',
                ].join(' ')}
              >
                <span className="font-medium text-ink">{team.team_name}</span>
                <span className="text-[0.6875rem] text-muted-ink">
                  {team.venue} vs {team.opponent_name} · {team.kickoff_london}
                </span>
                <span className="text-[0.625rem] uppercase tracking-wide text-muted-ink">
                  {isUsed ? 'Used' : isSelected ? 'Selected' : ''}
                </span>
              </button>
            )
          })}
        </div>

        {canPick && !locked ? (
          <button
            type="button"
            disabled={!selectedTeamId || saving}
            onClick={() => void handleSavePick()}
            className="los-btn-primary w-fit"
          >
            {saving ? 'Saving…' : selection?.team_id ? 'Update pick' : 'Save pick'}
          </button>
        ) : null}
      </div>
    </Card>
  )
}
