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
      <div className="los-dist-head">
        <TeamChip teamId={row.teamId} size="sm" />
        <span className="los-dist-name">{row.teamName}</span>
        <span className="los-dist-count">{compact ? `${row.percent}%` : formatPickCount(row.count)}</span>
      </div>
      <div className="los-dist-meta">
        {compact ? null : <span className="los-dist-pct">{row.percent}%</span>}
        <div className="los-pick-bar" aria-hidden="true">
          <span style={{ width: `${row.percent}%`, background: identity.primary }} />
        </div>
      </div>
    </li>
  )
}
