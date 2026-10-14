import { useCallback, useEffect, useState } from 'react'
import { Card } from '../components/Card'
import { CurrentPicksPreview } from '../components/ui-lab/CurrentPicksPreview'
import { CURRENT_GAME } from '../lib/constants'
import { fetchCurrentGame } from '../lib/gameEntries'
import {
  CURRENT_PICKS_EMPTY_MESSAGE,
  CURRENT_PICKS_VISIBLE_WHILE_OPEN,
  ROUND1_PUBLIC_LABEL,
  currentPicksBoardIntro,
  operationalWindowToRoundLabel,
} from '../lib/round1'
import { PUBLIC_PRE_LAUNCH_POINTS } from '../lib/preLaunch'
import { fetchCurrentSelectionWindow, fetchCurrentWindowPicks } from '../lib/selections'
import { isSupabaseConfigured } from '../lib/supabase'
import { canViewCurrentPicks } from '../lib/windowGuards'
import type { Game, SelectionWindow, WindowPickRow } from '../types'

export function CurrentPicksPage() {
  const [game, setGame] = useState<Game | null>(null)
  const [window, setWindow] = useState<SelectionWindow | null>(null)
  const [rows, setRows] = useState<WindowPickRow[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  const loadPicks = useCallback(async () => {
    if (!isSupabaseConfigured) {
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
        setRows([])
        return
      }

      const currentWindow = await fetchCurrentSelectionWindow(currentGame.id)
      setWindow(currentWindow)

      if (!currentWindow) {
        setRows([])
        return
      }

      const picks = await fetchCurrentWindowPicks(currentGame.id, currentWindow.id)
      setRows(picks.sort((a, b) => a.display_name.localeCompare(b.display_name)))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load current picks.'
      setPageError(message)
    } finally {
      setPageLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPicks()
  }, [loadPicks])

  if (pageLoading) {
    return (
      <Card title="Current picks" description="Loading…" compact>
        <p className="text-xs text-muted-ink">Please wait.</p>
      </Card>
    )
  }

  const roundLabel = window ? operationalWindowToRoundLabel(window.window_number) : ROUND1_PUBLIC_LABEL
  const submittedCount = rows.filter((row) => Boolean(row.team_id)).length
  const showPicksBoard = Boolean(window && CURRENT_PICKS_VISIBLE_WHILE_OPEN && canViewCurrentPicks(window))

  if (pageError) {
    return (
      <Card title="Current picks" compact>
        <div className="los-alert los-alert-error">
          {pageError}
          <button type="button" onClick={() => void loadPicks()} className="ml-2 underline">
            Retry
          </button>
        </div>
      </Card>
    )
  }

  if (!isSupabaseConfigured) {
    return (
      <Card title="Current picks" compact>
        <p className="text-xs text-muted-ink">Supabase is not configured.</p>
      </Card>
    )
  }

  if (!window || !showPicksBoard) {
    return (
      <Card title="Current picks" description={`Game ${game?.game_number ?? CURRENT_GAME} · Open to all players`} compact>
        <div className="grid gap-2">
          <p className="text-xs text-muted-ink">{PUBLIC_PRE_LAUNCH_POINTS[0]}</p>
          <p className="text-xs text-muted-ink">
            When {ROUND1_PUBLIC_LABEL} is live, every player&apos;s pick will appear here automatically. You do not need
            to submit your own pick first to view others.
          </p>
        </div>
      </Card>
    )
  }

  if (submittedCount === 0) {
    return (
      <Card title="Current picks" description={`Game ${game?.game_number ?? CURRENT_GAME} · ${roundLabel}`} compact>
        <p className="text-xs text-muted-ink">{CURRENT_PICKS_EMPTY_MESSAGE}</p>
      </Card>
    )
  }

  return (
    <div className="grid gap-3">
      <p className="px-1 text-xs text-muted-ink">{currentPicksBoardIntro(roundLabel)}</p>
      <CurrentPicksPreview roundLabel={roundLabel} window={window} rows={rows} />
    </div>
  )
}
