import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { HISTORY_GAMES_1_TO_27 } from '../config/history'
import { CURRENT_GAME, CURRENT_POT_GBP, formatGBP } from '../lib/constants'

function outcomeLabel(outcome: string) {
  return outcome.replaceAll('_', ' ')
}

function outcomeVariant(outcome: string, gameNumber: number): 'success' | 'warning' | 'muted' | 'open' {
  if (gameNumber === CURRENT_GAME) return 'open'
  if (outcome.includes('winner')) return 'success'
  if (outcome.includes('rollover')) return 'warning'
  return 'muted'
}

export function HistoryPage() {
  const rows = [...HISTORY_GAMES_1_TO_27].reverse()

  return (
    <Card title="History" description={`Games 1–${CURRENT_GAME} · placeholder outcomes`} compact>
      <DataTable minWidth="520px">
        <thead>
          <tr>
            <th>Game</th>
            <th>Season</th>
            <th>Result</th>
            <th>Winner</th>
            <th className="num">Pot</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isCurrent = r.game_number === CURRENT_GAME
            const isRollover = r.outcome.includes('rollover')
            return (
              <tr key={r.id} className={isCurrent ? 'bg-purple/[0.03]' : isRollover ? 'text-muted-ink' : ''}>
                <td className="tabular-nums font-medium">{r.game_number}</td>
                <td className="text-muted-ink">2025/26</td>
                <td>
                  <Badge variant={outcomeVariant(r.outcome, r.game_number)}>
                    {isCurrent ? 'In progress' : outcomeLabel(r.outcome)}
                  </Badge>
                </td>
                <td className="text-muted-ink">—</td>
                <td className="num font-medium tabular-nums">
                  {isCurrent ? formatGBP(CURRENT_POT_GBP) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </DataTable>
    </Card>
  )
}
