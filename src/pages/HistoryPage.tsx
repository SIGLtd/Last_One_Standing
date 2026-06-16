import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
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
  const currentGame = HISTORY_GAMES_1_TO_27.find((r) => r.game_number === CURRENT_GAME)

  return (
    <div className="grid gap-4">
      <Card
        title="History"
        description={`Seeded results from Game 1 to Game ${CURRENT_GAME} (placeholder outcomes)`}
      >
        {currentGame ? (
          <div className="los-result-card los-result-card-current mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-cyan">Current game</p>
                <h3 className="mt-1 text-2xl font-extrabold text-purple">Game {CURRENT_GAME}</h3>
              </div>
              <Badge variant="open">{formatGBP(CURRENT_POT_GBP)} pot</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-ink">{currentGame.notes}</p>
          </div>
        ) : null}

        <div className="grid gap-2">
          {HISTORY_GAMES_1_TO_27.filter((r) => r.game_number !== CURRENT_GAME)
            .reverse()
            .map((r) => (
              <div
                key={r.id}
                className={[
                  'los-result-card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
                  r.game_number >= 20 ? 'border-magenta/20' : '',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-extrabold text-purple">Game {r.game_number}</span>
                  <Badge variant={outcomeVariant(r.outcome, r.game_number)}>{outcomeLabel(r.outcome)}</Badge>
                </div>
                <div className="text-xs text-muted-ink">{r.notes ?? ''}</div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  )
}
