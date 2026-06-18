import { useCallback, useEffect, useMemo, useState } from 'react'
import { ButtonLink } from '../components/ButtonLink'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { TEAMS_2026 } from '../config/teams'
import { useAuth } from '../contexts/AuthContext'
import { CURRENT_GAME, formatEligibleSelectionDays } from '../lib/constants'
import { fetchCurrentGame, fetchMyGameEntry } from '../lib/gameEntries'
import {
  fetchCurrentSelectionWindow,
  fetchMySelection,
  fetchUsedTeamIds,
  isWindowEditable,
  isWindowLocked,
  saveSelection,
} from '../lib/selections'
import type { Game, GameEntry, Selection, SelectionWindow } from '../types'

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB')
}

export function PickPage() {
  const { user, player, loading: authLoading, configured } = useAuth()
  const [game, setGame] = useState<Game | null>(null)
  const [entry, setEntry] = useState<GameEntry | null>(null)
  const [window, setWindow] = useState<SelectionWindow | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [usedTeamIds, setUsedTeamIds] = useState<string[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
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
        setSelection(null)
        return
      }

      const [myEntry, currentWindow] = await Promise.all([
        fetchMyGameEntry(player.id, currentGame.id),
        fetchCurrentSelectionWindow(currentGame.id),
      ])

      setEntry(myEntry)
      setWindow(currentWindow)

      if (currentWindow) {
        const [mySelection, usedTeams] = await Promise.all([
          fetchMySelection(player.id, currentGame.id, currentWindow.id),
          fetchUsedTeamIds(player.id, currentGame.id, currentWindow.id),
        ])

        setSelection(mySelection)
        setUsedTeamIds(usedTeams)
        setSelectedTeamId(mySelection?.team_id ?? null)
      } else {
        setSelection(null)
        setUsedTeamIds([])
        setSelectedTeamId(null)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load pick page.'
      setPageError(message)
    } finally {
      setPageLoading(false)
    }
  }, [configured, player])

  useEffect(() => {
    if (!authLoading) {
      void loadPickPage()
    }
  }, [authLoading, loadPickPage])

  const selectedTeam = useMemo(
    () => TEAMS_2026.find((team) => team.id === selectedTeamId) ?? null,
    [selectedTeamId],
  )

  async function handleSavePick() {
    if (!player || !game || !window || !selectedTeamId) {
      return
    }

    setSaving(true)
    setPageError(null)
    setSavedMessage(null)

    try {
      const saved = await saveSelection({
        gameId: game.id,
        windowId: window.id,
        playerId: player.id,
        teamId: selectedTeamId,
        window,
      })
      setSelection(saved)
      setSavedMessage(`Saved ${selectedTeam?.name ?? 'pick'} for window ${window.window_number}.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save pick.'
      setPageError(message)
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || pageLoading) {
    return (
      <div className="grid gap-4">
        <Card title="Make your pick" description="Loading...">
          <p className="text-sm text-muted-ink">Please wait.</p>
        </Card>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="grid gap-4">
        <Card title="Make your pick" description="Login required">
          <div className="grid gap-3">
            <p className="text-sm text-muted-ink">Log in or sign up to make your pick.</p>
            <div className="flex flex-wrap gap-2">
              <ButtonLink to="/login">Log in</ButtonLink>
              <ButtonLink to="/signup" variant="secondary">
                Sign up
              </ButtonLink>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (!entry?.paid || entry.status !== 'active') {
    return (
      <div className="grid gap-4">
        <Card title="Make your pick" description={`Game ${CURRENT_GAME}`}>
          <p className="text-sm text-muted-ink">You need verified entry before making a pick.</p>
        </Card>
      </div>
    )
  }

  if (!window || window.status === 'pending') {
    return (
      <div className="grid gap-4">
        <Card title="Make your pick" description={`Game ${CURRENT_GAME}`}>
          <p className="text-sm text-muted-ink">No selection window is open yet.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <Card
        title="Make your pick"
        description={`Game ${CURRENT_GAME} • Window ${window.window_number}`}
        right={<Badge variant={locked ? 'muted' : 'open'}>{locked ? 'Locked' : 'Open'}</Badge>}
      >
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="los-panel p-3">
              <div className="text-xs font-extrabold uppercase tracking-wide text-muted-ink">Deadline</div>
              <div className="mt-1 text-sm font-bold text-ink">{formatDateTime(window.deadline_at)}</div>
              <div className="mt-2 text-xs text-muted-ink">
                Window runs {formatDateTime(window.start_at)} to {formatDateTime(window.end_at)}
              </div>
            </div>

            <div className="los-panel p-3">
              <div className="text-xs font-extrabold uppercase tracking-wide text-muted-ink">Selected team</div>
              <div className="mt-1 text-lg font-extrabold text-purple">
                {selectedTeam ? selectedTeam.name : 'No team selected'}
              </div>
              <div className="mt-2 text-xs text-muted-ink">
                {locked
                  ? 'Selection is read-only after lock.'
                  : 'You can change your pick any time before the deadline.'}
              </div>
            </div>
          </div>

          {pageError ? <div className="los-alert los-alert-error">{pageError}</div> : null}

          {savedMessage ? <div className="los-alert los-alert-success">{savedMessage}</div> : null}

          <p className="text-sm text-muted-ink">
            Only teams playing in eligible {formatEligibleSelectionDays()} fixtures should be selected for this window.
            Friday and Monday games are not eligible.
          </p>

          <div className="grid gap-2 md:grid-cols-2">
            {TEAMS_2026.map((team) => {
              const isUsed = usedTeamIds.includes(team.id)
              const isSelected = selectedTeamId === team.id
              const disabled = !canPick || locked || (isUsed && !isSelected)

              return (
                <button
                  key={team.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelectedTeamId(team.id)}
                  className={[
                    'los-fixture-tile',
                    disabled ? 'los-fixture-tile-used cursor-not-allowed' : 'cursor-pointer',
                    isSelected ? 'los-fixture-tile-selected' : '',
                  ].join(' ')}
                >
                  <span className="font-bold text-ink">{team.name}</span>
                  <span className="text-xs font-extrabold uppercase tracking-wide text-muted-ink">
                    {isUsed ? 'Used' : isSelected ? 'Selected' : 'Available'}
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
              className="los-btn-primary h-11 w-full sm:w-auto"
            >
              {saving ? 'Saving...' : selection?.team_id ? 'Update pick' : 'Save pick'}
            </button>
          ) : null}
        </div>
      </Card>
    </div>
  )
}
