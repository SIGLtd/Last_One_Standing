import { ButtonLink } from '../ButtonLink'
import { Badge } from '../Badge'
import { MetricCell, MetricStrip } from '../MetricCell'
import { formatLondonDateTime } from '../../lib/fixtureOps'
import type { RoundControlStats } from '../../lib/adminCockpit'

type AdminRoundControlCardProps = {
  stats: RoundControlStats
}

export function AdminRoundControlCard({ stats }: AdminRoundControlCardProps) {
  return (
    <section className="los-admin-section los-cockpit-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="los-section-title">{stats.roundLabel} control</h2>
        <Badge variant="open">{stats.statusLabel}</Badge>
      </div>

      <MetricStrip className="mt-2">
        <MetricCell label="Deadline" value={formatLondonDateTime(stats.deadlineLabel)} />
        <MetricCell label="Time left" value={stats.timeRemaining} />
        <MetricCell label="Fixtures" value={stats.eligibleFixtureCount} />
        <MetricCell label="Picks in" value={stats.selectionsMade} />
      </MetricStrip>

      <MetricStrip className="mt-2">
        <MetricCell label="Paid active" value={stats.paidActivePlayers} />
        <MetricCell label="Awaiting verify" value={stats.awaitingVerification} />
      </MetricStrip>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <ButtonLink to="/current-picks" className="los-tap-target w-full sm:w-auto">
          Review current picks
        </ButtonLink>
        <a href="#players-payments" className="los-btn-secondary los-tap-target w-full text-center sm:w-auto">
          Manage payments
        </a>
      </div>
    </section>
  )
}
