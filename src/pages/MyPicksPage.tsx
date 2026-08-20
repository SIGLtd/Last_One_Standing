import { useCallback, useEffect, useState } from 'react'
import { ButtonLink } from '../components/ButtonLink'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { useAuth, authPhaseLabel } from '../contexts/AuthContext'
import { fetchCurrentGame } from '../lib/gameEntries'
import { formatLondonDateTime } from '../lib/fixtureOps'
import { fetchMyPickHistory, type PickHistoryRow } from '../lib/pickHistory'

export function MyPicksPage() {
  const { user, player, loading, authPhase } = useAuth()
  const [rows, setRows] = useState<PickHistoryRow[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    if (!player) {
      setRows([])
      setPageLoading(false)
      return
    }

    setPageLoading(true)
    setPageError(null)

    try {
      const game = await fetchCurrentGame()
      if (!game) {
        setRows([])
        return
      }
      const history = await fetchMyPickHistory(player.id, game.id)
      setRows(history)
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to load pick history.')
    } finally {
      setPageLoading(false)
    }
  }, [player])

  useEffect(() => {
    if (!loading) void loadHistory()
  }, [loading, loadHistory])

  if (loading || pageLoading) {
    return (
      <Card title="My pick history" description={loading ? authPhaseLabel(authPhase) : 'Loading pick history…'} compact>
        <p className="text-xs text-muted-ink">Please wait.</p>
      </Card>
    )
  }

  if (!user) {
    return (
      <Card title="My pick history" description="Login required" compact>
        <p className="text-xs text-muted-ink mb-2">Log in to see your own picks only.</p>
        <ButtonLink to="/login">Log in</ButtonLink>
      </Card>
    )
  }

  return (
    <Card title="My pick history" description="Your selections for this game" compact>
      {pageError ? <div className="mb-2 los-alert los-alert-error">{pageError}</div> : null}

      {rows.length === 0 ? (
        <p className="text-xs text-muted-ink">No picks stored yet. When you save a pick, it will appear here.</p>
      ) : (
        <>
          <div className="hidden md:block">
            <DataTable minWidth="720px">
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Team</th>
                  <th>Fixture</th>
                  <th>Submitted</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.selectionId}>
                    <td className="font-medium">{row.roundLabel}</td>
                    <td>{row.teamName}</td>
                    <td className="text-muted-ink">{row.fixtureLabel}</td>
                    <td className="text-muted-ink">{row.submittedAt ? formatLondonDateTime(row.submittedAt) : '—'}</td>
                    <td>
                      <Badge variant={row.usedFinal ? 'muted' : 'open'}>{row.statusLabel}</Badge>
                      {row.adminEntered ? <span className="ml-1 text-[0.625rem] text-muted-ink">Admin entered</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>

          <div className="los-divider-list md:hidden">
            {rows.map((row) => (
              <div key={row.selectionId} className="los-divider-row">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ink">{row.roundLabel}</span>
                  <Badge variant={row.usedFinal ? 'muted' : 'open'}>{row.statusLabel}</Badge>
                </div>
                <div className="mt-0.5 text-ink">{row.teamName}</div>
                <div className="text-[0.6875rem] text-muted-ink">{row.fixtureLabel}</div>
                {row.adminEntered ? <div className="text-[0.625rem] text-muted-ink">Entered by admin</div> : null}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
