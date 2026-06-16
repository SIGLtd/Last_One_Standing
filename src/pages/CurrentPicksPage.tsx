import { useCallback, useEffect, useState } from 'react'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { TEAM_ID_TO_NAME } from '../config/teams'
import { CURRENT_GAME } from '../lib/constants'
import { fetchCurrentGame } from '../lib/gameEntries'
import { fetchCurrentSelectionWindow, fetchCurrentWindowPicks, getPickStatusLabel } from '../lib/selections'
import { isSupabaseConfigured } from '../lib/supabase'
import type { Game, SelectionWindow, WindowPickRow } from '../types'

function pickStatusVariant(label: string): 'success' | 'warning' | 'muted' | 'open' {
  const lower = label.toLowerCase()
  if (lower.includes('picked') || lower.includes('saved')) return 'success'
  if (lower.includes('no pick') || lower.includes('missing')) return 'warning'
  if (lower.includes('locked')) return 'muted'
  return 'open'
}

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
          <p className="text-sm text-muted-ink">Please wait.</p>
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
        right={window ? <Badge variant="open">Live board</Badge> : undefined}
      >
        {pageError ? <div className="mb-4 los-alert los-alert-error">{pageError}</div> : null}

        {!isSupabaseConfigured ? (
          <p className="text-sm text-muted-ink">Supabase is not configured.</p>
        ) : !window ? (
          <p className="text-sm text-muted-ink">No selection window has been created yet.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[720px] w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-xs font-extrabold uppercase tracking-wide text-muted-ink">
                    <th className="border-b border-border px-3 py-3">Player</th>
                    <th className="border-b border-border px-3 py-3">Selected team</th>
                    <th className="border-b border-border px-3 py-3">Pick status</th>
                    <th className="border-b border-border px-3 py-3">Survival status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-sm text-muted-ink">
                        No active players in Game {game?.game_number ?? CURRENT_GAME} yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const teamName = row.team_id ? TEAM_ID_TO_NAME.get(row.team_id) : null
                      const statusLabel = getPickStatusLabel(row, window)
                      return (
                        <tr key={row.player_id} className="text-sm">
                          <td className="border-b border-border/70 px-3 py-3 font-bold text-ink">{row.display_name}</td>
                          <td className="border-b border-border/70 px-3 py-3 font-semibold text-purple">
                            {teamName ?? <span className="font-normal text-muted-ink">No pick yet</span>}
                          </td>
                          <td className="border-b border-border/70 px-3 py-3">
                            <Badge variant={pickStatusVariant(statusLabel)}>{statusLabel}</Badge>
                          </td>
                          <td className="border-b border-border/70 px-3 py-3 text-muted-ink">Placeholder</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2 md:hidden">
              {rows.length === 0 ? (
                <p className="text-sm text-muted-ink">
                  No active players in Game {game?.game_number ?? CURRENT_GAME} yet.
                </p>
              ) : (
                rows.map((row) => {
                  const teamName = row.team_id ? TEAM_ID_TO_NAME.get(row.team_id) : null
                  const statusLabel = getPickStatusLabel(row, window)
                  return (
                    <div key={row.player_id} className="los-selection-row grid gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-ink">{row.display_name}</div>
                        <Badge variant={pickStatusVariant(statusLabel)}>{statusLabel}</Badge>
                      </div>
                      <div className="text-sm">
                        <span className="text-xs font-extrabold uppercase tracking-wide text-muted-ink">Team </span>
                        <span className="font-bold text-purple">{teamName ?? 'No pick yet'}</span>
                      </div>
                      <div className="text-xs text-muted-ink">Survival status: Placeholder</div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
