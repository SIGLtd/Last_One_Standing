import { useCallback, useEffect, useState } from 'react'
import { Card } from '../components/Card'
import { TEAM_ID_TO_NAME } from '../config/teams'
import { CURRENT_GAME } from '../lib/constants'
import { fetchCurrentGame } from '../lib/gameEntries'
import { fetchCurrentSelectionWindow, fetchCurrentWindowPicks, getPickStatusLabel } from '../lib/selections'
import { isSupabaseConfigured } from '../lib/supabase'
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
      <div className="grid gap-4">
        <Card title="Current picks" description="Loading...">
          <p className="text-sm text-muted">Please wait.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <Card
        title="Current picks"
        description={
          window
            ? `Game ${CURRENT_GAME} • Window ${window.window_number} • Visible to everyone at all times`
            : `Game ${CURRENT_GAME} • Visible to everyone at all times`
        }
      >
        {pageError ? (
          <div className="mb-4 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text">
            {pageError}
          </div>
        ) : null}

        {!isSupabaseConfigured ? (
          <p className="text-sm text-muted">Supabase is not configured.</p>
        ) : !window ? (
          <p className="text-sm text-muted">No selection window has been created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs font-semibold text-muted">
                  <th className="border-b border-border px-3 py-3">Player</th>
                  <th className="border-b border-border px-3 py-3">Selected team</th>
                  <th className="border-b border-border px-3 py-3">Pick status</th>
                  <th className="border-b border-border px-3 py-3">Survival status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-sm text-muted">
                      No active players in Game {game?.game_number ?? CURRENT_GAME} yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const teamName = row.team_id ? TEAM_ID_TO_NAME.get(row.team_id) : null
                    return (
                      <tr key={row.player_id} className="text-sm">
                        <td className="border-b border-border/70 px-3 py-3 font-semibold">{row.display_name}</td>
                        <td className="border-b border-border/70 px-3 py-3 text-text">
                          {teamName ?? <span className="text-muted">No pick yet</span>}
                        </td>
                        <td className="border-b border-border/70 px-3 py-3 text-muted">
                          {getPickStatusLabel(row, window)}
                        </td>
                        <td className="border-b border-border/70 px-3 py-3 text-muted">Placeholder</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
