import { useEffect, useState } from 'react'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { MetricCell, MetricStrip } from '../components/MetricCell'
import { formatHistorySeason, getHistorySummary, HISTORY_GAMES_1_TO_27 } from '../config/history'
import { formatGBP } from '../lib/constants'
import { fetchGames } from '../lib/gameEntries'
import { historyOutcomeNote, mergeHistoryWithLiveGames } from '../lib/gameLifecycle'
import { isSupabaseConfigured } from '../lib/supabase'
import type { Game, HistoricalResult } from '../types'

function resultLabel(resultType: HistoricalResult['result_type']) {
  switch (resultType) {
    case 'winner':
      return 'Winner'
    case 'rollover':
      return 'Rollover'
    case 'active':
      return 'In progress'
  }
}

function resultVariant(resultType: HistoricalResult['result_type']): 'success' | 'warning' | 'muted' | 'open' {
  switch (resultType) {
    case 'winner':
      return 'success'
    case 'rollover':
      return 'warning'
    case 'active':
      return 'open'
  }
}

function winnerDisplay(row: HistoricalResult) {
  if (row.result_type === 'winner') return row.winner_name ?? '—'
  return '—'
}

export function HistoryPage() {
  const [liveGames, setLiveGames] = useState<Game[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    void fetchGames()
      .then(setLiveGames)
      .catch((error) => {
        console.error('Failed to load live game history', error)
        setLiveGames([])
      })
  }, [])

  const history = mergeHistoryWithLiveGames(HISTORY_GAMES_1_TO_27, liveGames)
  const summary = getHistorySummary(history)
  const rows = [...history].reverse()
  const latestNumber = history[history.length - 1]?.game_number ?? 27

  return (
    <Card title="History" description={`Games 1–${latestNumber}`} compact>
      <p className="mb-3 text-xs text-muted-ink">
        Seasons marked TBC are waiting for Iain to confirm historic winner years. Completed games stay in this list.
      </p>
      <MetricStrip className="mb-3">
        <MetricCell label="Paid to winners" value={formatGBP(summary.totalPaidOut)} />
        <MetricCell
          label="Biggest win"
          value={`${formatGBP(summary.biggestWin.pot)} · G${summary.biggestWin.game_number}`}
        />
        <MetricCell label="Rollovers" value={summary.rolloverCount} />
        <MetricCell label="Repeat winners" value={summary.repeatWinners} />
      </MetricStrip>

      <DataTable minWidth="640px">
        <thead>
          <tr>
            <th>Game</th>
            <th>Season</th>
            <th>Result</th>
            <th>Winner</th>
            <th className="num">Pot</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={row.result_type === 'active' ? 'bg-purple/[0.03]' : row.result_type === 'rollover' ? 'text-muted-ink' : ''}
            >
              <td className="tabular-nums font-medium">{row.game_number}</td>
              <td className="text-muted-ink">{formatHistorySeason(row)}</td>
              <td>
                <Badge variant={resultVariant(row.result_type)}>{resultLabel(row.result_type)}</Badge>
              </td>
              <td className={row.result_type === 'winner' ? 'font-medium' : 'text-muted-ink'}>
                {winnerDisplay(row)}
              </td>
              <td className="num font-medium tabular-nums">{formatGBP(row.pot)}</td>
              <td className="text-muted-ink text-[0.6875rem]">{historyOutcomeNote(row)}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </Card>
  )
}
