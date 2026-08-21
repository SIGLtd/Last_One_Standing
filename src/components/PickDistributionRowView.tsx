import { TeamChip } from './TeamChip'
import { formatPickCount, type PickDistributionRow } from '../lib/pickDistribution'
import { getTeamIdentity } from '../lib/teamIdentity'

export function PickDistributionRowView({
  row,
  compact = false,
}: {
  row: PickDistributionRow
  compact?: boolean
}) {
  const identity = getTeamIdentity(row.teamId)

  return (
    <li className={compact ? 'los-dist-row los-dist-row-compact' : 'los-dist-row'}>
      <TeamChip teamId={row.teamId} size="lg" />
      <div className="los-dist-copy">
        <span className="los-dist-name">{row.teamName}</span>
        <div className="los-pick-bar" aria-hidden="true">
          <span style={{ width: `${row.percent}%`, background: identity.primary }} />
        </div>
      </div>
      <div className="los-dist-stat">
        {compact ? null : <span className="los-dist-count">{formatPickCount(row.count)}</span>}
        <span className="los-dist-pct">{row.percent}%</span>
      </div>
    </li>
  )
}
