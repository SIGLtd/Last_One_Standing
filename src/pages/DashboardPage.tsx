import { Card } from '../components/Card'
import { CURRENT_GAME, CURRENT_POT_GBP, FEES, STATUS, formatGBP } from '../lib/constants'

export function DashboardPage() {
  // Milestone 1: static placeholder "current user" view (no auth gating yet)
  const player = {
    displayName: 'You',
    status: 'active' as const,
    survivalStatus: STATUS.offSeason ? 'Off-season' : 'Alive',
    entryType: 'returning' as const,
    paymentStatus: 'unpaid' as const,
    amountDue: FEES.returning_player,
    currentPick: null as string | null,
    usedTeams: ['Arsenal', 'Liverpool', 'Manchester City'],
    nextAction: STATUS.offSeason ? 'Wait for the next selection window.' : 'Make or update your pick.',
  }

  return (
    <div className="grid gap-4">
      <Card title="Dashboard" description={`Game ${CURRENT_GAME} • Pot ${formatGBP(CURRENT_POT_GBP)}`}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="text-xs font-semibold text-muted">Player status</div>
            <div className="mt-1 text-sm text-text">
              <span className="font-semibold">{player.displayName}</span> • {player.status}
            </div>
            <div className="mt-2 text-xs font-semibold text-muted">Survival</div>
            <div className="mt-1 text-sm text-text">{player.survivalStatus}</div>
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="text-xs font-semibold text-muted">Payment</div>
            <div className="mt-1 text-sm text-text">
              {player.entryType === 'returning' ? 'Returning player' : 'New player'} • {player.paymentStatus}
            </div>
            <div className="mt-2 text-xs font-semibold text-muted">Amount due</div>
            <div className="mt-1 text-sm text-text">{formatGBP(player.amountDue)}</div>
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="text-xs font-semibold text-muted">Current pick</div>
            <div className="mt-1 text-sm text-text">{player.currentPick ?? 'No pick submitted yet'}</div>
            <div className="mt-2 text-xs font-semibold text-muted">Next action</div>
            <div className="mt-1 text-sm text-text">{player.nextAction}</div>
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="text-xs font-semibold text-muted">Used teams (this game)</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {player.usedTeams.map((t) => (
                <span key={t} className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

