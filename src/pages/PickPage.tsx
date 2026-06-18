import { useCallback, useEffect, useMemo, useState } from 'react'
import { ButtonLink } from '../components/ButtonLink'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { MetricCell, MetricStrip } from '../components/MetricCell'
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
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
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
    if (!player || !game || !window || !selectedTeamId) return

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

  if (!window || window.status === 'pending') {
    return (
      <Card title="Make your pick" description={`Game ${CURRENT_GAME}`} compact>
        <p className="text-xs text-muted-ink">No selection window is open yet.</p>
      </Card>
    )
  }

  return (
    <Card
      title="Make your pick"
      description={`Game ${CURRENT_GAME} · Window ${window.window_number}`}
      right={<Badge variant={locked ? 'muted' : 'open'}>{locked ? 'Locked' : 'Open'}</Badge>}
      compact
    >
      <div className="grid gap-2">
        <MetricStrip>
          <MetricCell label="Deadline" value={formatDateTime(window.deadline_at)} />
          <MetricCell label="Selected" value={selectedTeam?.name ?? '—'} />
          <MetricCell label="Window" value={`${formatDateTime(window.start_at)} – ${formatDateTime(window.end_at)}`} />
        </MetricStrip>

        {pageError ? <div className="los-alert los-alert-error">{pageError}</div> : null}
        {savedMessage ? <div className="los-alert los-alert-success">{savedMessage}</div> : null}

        <p className="text-xs text-muted-ink">
          Select from eligible {formatEligibleSelectionDays()} fixtures only. Friday and Monday games excluded.
        </p>

        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
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
                <span className="font-medium text-ink">{team.name}</span>
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
