import { useCallback, useEffect, useState } from 'react'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { TEAM_ID_TO_NAME } from '../config/teams'
import { CURRENT_GAME } from '../lib/constants'
import { fetchCurrentGame } from '../lib/gameEntries'
import { CURRENT_PICKS_PRE_LAUNCH_MESSAGE } from '../lib/preLaunch'
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
      <Card title="Current picks" description="Loading…" compact>
        <p className="text-xs text-muted-ink">Please wait.</p>
      </Card>
    )
  }

  return (
    <Card
      title="Current picks"
      description={
        window
          ? `Game ${CURRENT_GAME} · Window ${window.window_number} · Open to all players`
          : `Game ${CURRENT_GAME} · Open to all players`
      }
      compact
    >
      {pageError ? (
        <div className="mb-2 los-alert los-alert-error">
          {pageError}
          <button type="button" onClick={() => void loadPicks()} className="ml-2 underline">
            Retry
          </button>
        </div>
      ) : null}

      {!isSupabaseConfigured ? (
        <p className="text-xs text-muted-ink">Supabase is not configured.</p>
      ) : !window ? (
        <div className="grid gap-2">
          <p className="text-xs text-muted-ink">{CURRENT_PICKS_PRE_LAUNCH_MESSAGE}</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <DataTable minWidth="640px">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Pick</th>
                  <th>Fixture / status</th>
                  <th>Survival</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-muted-ink">
                      No active players in Game {game?.game_number ?? CURRENT_GAME}.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const teamName = row.team_id ? TEAM_ID_TO_NAME.get(row.team_id) : null
                    const statusLabel = getPickStatusLabel(row, window)
                    return (
                      <tr key={row.player_id}>
                        <td className="font-medium text-ink">{row.display_name}</td>
                        <td className="font-medium">{teamName ?? <span className="text-muted-ink font-normal">—</span>}</td>
                        <td>
                          <Badge variant={pickStatusVariant(statusLabel)}>{statusLabel}</Badge>
                        </td>
                        <td className="text-muted-ink">—</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </DataTable>
          </div>

          <div className="los-divider-list md:hidden">
            {rows.length === 0 ? (
              <div className="los-divider-row text-muted-ink">
                No active players in Game {game?.game_number ?? CURRENT_GAME}.
              </div>
            ) : (
              rows.map((row) => {
                const teamName = row.team_id ? TEAM_ID_TO_NAME.get(row.team_id) : null
                const statusLabel = getPickStatusLabel(row, window)
                return (
                  <div key={row.player_id} className="los-divider-row">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink">{row.display_name}</span>
                      <Badge variant={pickStatusVariant(statusLabel)}>{statusLabel}</Badge>
                    </div>
                    <div className="mt-0.5 text-muted-ink">
                      Pick: <span className="text-ink">{teamName ?? '—'}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </Card>
  )
}
