import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { MetricCell, MetricStrip } from '../components/MetricCell'
import { getHistorySummary, HISTORY_GAMES_1_TO_27 } from '../config/history'
import { CURRENT_GAME, formatGBP } from '../lib/constants'
import type { HistoricalResult } from '../types'

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
  const summary = getHistorySummary(HISTORY_GAMES_1_TO_27)
  const rows = [...HISTORY_GAMES_1_TO_27].reverse()

  return (
    <Card title="History" description={`Games 1–${CURRENT_GAME}`} compact>
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
              <td className="text-muted-ink">{row.season}</td>
              <td>
                <Badge variant={resultVariant(row.result_type)}>{resultLabel(row.result_type)}</Badge>
              </td>
              <td className={row.result_type === 'winner' ? 'font-medium' : 'text-muted-ink'}>
                {winnerDisplay(row)}
              </td>
              <td className="num font-medium tabular-nums">{formatGBP(row.pot)}</td>
              <td className="text-muted-ink text-[0.6875rem]">{row.notes ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </Card>
  )
}
