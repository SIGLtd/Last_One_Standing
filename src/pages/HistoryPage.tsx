import { Card } from '../components/Card'
import { HISTORY_GAMES_1_TO_27 } from '../config/history'

export function HistoryPage() {
  return (
    <div className="grid gap-4">
      <Card title="History" description="Seeded results from Game 1 to Game 27 (placeholder outcomes)">
        <div className="grid gap-2">
          {HISTORY_GAMES_1_TO_27.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-1 rounded-xl border border-border bg-surface-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-sm">
                <span className="font-semibold text-text">Game {r.game_number}</span>{' '}
                <span className="text-muted">• {r.outcome.replaceAll('_', ' ')}</span>
              </div>
              <div className="text-xs text-muted">{r.notes ?? ''}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

