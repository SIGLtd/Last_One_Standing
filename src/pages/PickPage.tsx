import { useCallback, useEffect, useState } from 'react'
import { ButtonLink } from '../components/ButtonLink'
import { Card } from '../components/Card'
import { PickPreview } from '../components/ui-lab/PickPreview'
import { useAuth, authPhaseLabel } from '../contexts/AuthContext'
import { CURRENT_GAME } from '../lib/constants'
import {
  fetchOpenSelectionWindow,
  fetchPlannedOperationalWindow,
  fetchPlayerFacingWindowFixtures,
  formatDeadlineLondon,
} from '../lib/fixtureOps'
import { PLAYER_COMPLETE_ENTRY_MESSAGE, operationalWindowToRoundLabel } from '../lib/round1'
import { fetchCurrentGame, fetchMyGameEntry } from '../lib/gameEntries'
import {
  fetchFinallyUsedTeamIds,
  fetchMySelection,
  isWindowEditable,
  isWindowLocked,
  saveSelection,
} from '../lib/selections'
import type { Game, GameEntry, Selection, SelectionWindowEligibleFixture, SelectionWindowWithMeta } from '../types'

export function PickPage() {
  const { user, player, loading: authLoading, authPhase, configured } = useAuth()
  const [game, setGame] = useState<Game | null>(null)
  const [entry, setEntry] = useState<GameEntry | null>(null)
  const [window, setWindow] = useState<SelectionWindowWithMeta | null>(null)
  const [plannedWindow, setPlannedWindow] = useState<SelectionWindowWithMeta | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [usedTeamIds, setUsedTeamIds] = useState<string[]>([])
  const [fixtures, setFixtures] = useState<SelectionWindowEligibleFixture[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  const locked = window ? isWindowLocked(window) : false
  const editable = window ? isWindowEditable(window) : false
  const pending = Boolean(entry && (!entry.paid || entry.status === 'pending_payment'))
  const eliminated = entry?.status === 'eliminated'
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
        setFixtures([])
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
        const [windowFixtures, mySelection, usedTeams] = await Promise.all([
          fetchPlayerFacingWindowFixtures(openWindow.id),
          fetchMySelection(player.id, currentGame.id, openWindow.id),
          fetchFinallyUsedTeamIds(player.id, currentGame.id),
        ])
        setFixtures(windowFixtures)
        setSelection(mySelection)
        setUsedTeamIds(usedTeams)
      } else {
        setFixtures([])
        setSelection(null)
        setUsedTeamIds([])
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

  async function handleSavePick(teamId: string) {
    if (!window) return

    setSaving(true)
    setPageError(null)
    setSavedMessage(null)

    try {
      const saved = await saveSelection({ windowId: window.id, teamId })
      setSelection(saved)
      setSavedMessage('Pick saved. You can change this before the deadline.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save pick.'
      setPageError(message)
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || pageLoading) {
    return (
      <Card title="Make your pick" description={authLoading ? authPhaseLabel(authPhase) : 'Loading pick data…'} compact>
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

  if (!window) {
    return (
      <Card title="Make your pick" description={`Game ${game?.game_number ?? CURRENT_GAME}`} compact>
        <p className="text-sm text-muted-ink">
          {plannedWindow
            ? 'No live round is open yet. Check back when the organiser opens the round.'
            : 'No live round is open yet. Check back when the organiser opens the round.'}
        </p>
        {pending ? <p className="mt-2 text-sm text-muted-ink">{PLAYER_COMPLETE_ENTRY_MESSAGE}</p> : null}
      </Card>
    )
  }

  const roundLabel = operationalWindowToRoundLabel(window.window_number)

  return (
    <PickPreview
      roundLabel={roundLabel}
      deadlineLabel={formatDeadlineLondon(window.deadline_at)}
      spectator={eliminated}
      fixtures={fixtures}
      usedTeamIds={usedTeamIds}
      live
      canPick={canPick}
      locked={locked}
      pending={pending}
      saving={saving}
      savedMessage={savedMessage}
      error={pageError}
      savedTeamId={selection?.team_id ?? null}
      onSave={(teamId) => void handleSavePick(teamId)}
    />
  )
}
