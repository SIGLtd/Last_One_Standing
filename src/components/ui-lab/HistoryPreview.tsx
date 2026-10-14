import { Badge } from '../Badge'
import { MetricCell, MetricStrip } from '../MetricCell'
import { formatHistorySeason, getHistorySummary } from '../../config/history'
import { formatGBP } from '../../lib/constants'
import { historyOutcomeNote } from '../../lib/gameLifecycle'
import {
  formatRepeatWinnersForPreview,
  historyCardKind,
  historyCardLabel,
} from '../../lib/uiLabPreview'
import type { HistoricalResult } from '../../types'

export function HistoryPreview({ history }: { history: HistoricalResult[] }) {
  const summary = getHistorySummary(history)
  const rows = [...history].reverse()

  return (
    <div className="grid gap-3">
      <section className="los-card p-4">
        <h2 className="text-sm font-semibold text-ink">History</h2>
        <p className="mt-0.5 text-xs text-muted-ink">{history.length} games</p>
        <MetricStrip className="mt-3">
          <MetricCell label="Paid to winners" value={formatGBP(summary.totalPaidOut)} />
          <MetricCell
            label="Biggest win"
            value={summary.biggestWin ? `${formatGBP(summary.biggestWin.pot)} · G${summary.biggestWin.game_number}` : 'None'}
          />
          <MetricCell label="Rollovers" value={summary.rolloverCount} />
          <MetricCell label="Repeat winners" value={formatRepeatWinnersForPreview(summary.repeatWinners)} />
        </MetricStrip>
      </section>

      <ul className="grid gap-2">
        {rows.map((row) => {
          const kind = historyCardKind(row.result_type)
          return (
            <li key={row.id} className="los-card p-4" data-history-kind={kind}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink">Game {row.game_number}</p>
                  <p className="text-xs text-muted-ink">{formatHistorySeason(row)}</p>
                </div>
                <Badge variant={kind === 'winner-paid' ? 'success' : kind === 'rollover' ? 'warning' : 'open'}>
                  {historyCardLabel(kind)}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-ink">
                {kind === 'winner-paid' ? row.winner_name ?? 'Winner' : kind === 'rollover' ? 'Pot rolled over' : 'In play'}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{formatGBP(row.pot)}</p>
              <p className="mt-1 text-xs text-muted-ink">{historyOutcomeNote(row)}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
