import { formatLondonDateTime } from '../lib/fixtureOps'
import type { DraftSnapshotComparison } from '../lib/window2Draft'
import {
  WINDOW2_DRAFT_ORGANISER_NOTE,
  WINDOW2_PLANNED_WEEKEND_LABEL,
} from '../lib/window2Draft'
import type { SelectionWindowEligibleFixture, SelectionWindowWithMeta } from '../types'
import { Badge } from './Badge'
import { DataTable } from './DataTable'
import { MetricCell, MetricStrip } from './MetricCell'

type Window2DraftPanelProps = {
  draftWindow: SelectionWindowWithMeta
  snapshotFixtures: SelectionWindowEligibleFixture[]
  comparison: DraftSnapshotComparison
  onRevalidate: () => void
  onApprove: () => void
  onDefer: () => void
  onReject: () => void
  busy: boolean
}

export function Window2DraftPanel({
  draftWindow,
  snapshotFixtures,
  comparison,
  onRevalidate,
  onApprove,
  onDefer,
  onReject,
  busy,
}: Window2DraftPanelProps) {
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="los-section-title">Window 2 draft (planned round)</h3>
        <Badge variant="warning">Pending · not live</Badge>
      </div>

      <div className="mt-2 los-alert los-alert-warning text-xs">
        Player selections are not open. This window is a draft only until revalidated and explicitly approved.
      </div>

      <p className="mt-2 text-xs text-muted-ink">{WINDOW2_DRAFT_ORGANISER_NOTE}</p>

      <MetricStrip className="mt-2">
        <MetricCell label="Window" value={draftWindow.window_number} />
        <MetricCell label="Weekend" value={WINDOW2_PLANNED_WEEKEND_LABEL} />
        <MetricCell label="Draft fixtures" value={snapshotFixtures.length} />
        <MetricCell label="Deadline (proposed)" value={formatLondonDateTime(draftWindow.deadline_at)} />
      </MetricStrip>

      <p className="mt-2 text-xs text-muted-ink">
        Earliest eligible kick-off:{' '}
        {draftWindow.earliest_kickoff_at ? formatLondonDateTime(draftWindow.earliest_kickoff_at) : '—'} (
        Europe/London)
      </p>

      <div
        className={
          comparison.matchesMaster
            ? 'mt-2 los-alert los-alert-success text-xs'
            : 'mt-2 los-alert los-alert-error text-xs'
        }
      >
        {comparison.matchesMaster
          ? `Draft snapshot matches live season_fixtures baseline (${comparison.masterEligibleCount} fixtures).`
          : `Draft snapshot differs from live baseline (${comparison.differences.length} issue(s)). Revalidate before approval.`}
      </div>

      {comparison.differences.length > 0 ? (
        <ul className="mt-1 list-disc pl-4 text-xs text-muted-ink">
          {comparison.differences.slice(0, 8).map((difference) => (
            <li key={difference}>{difference}</li>
          ))}
        </ul>
      ) : null}

      <p className="mt-2 text-xs font-medium text-ink">
        Next action: revalidate against season_fixtures, review differences, then approve and publish when ready.
      </p>

      <DataTable minWidth="720px" className="mt-3">
        <thead>
          <tr>
            <th>Home</th>
            <th>Away</th>
            <th>Kick-off (UK)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {snapshotFixtures.map((fixture) => (
            <tr key={fixture.id}>
              <td className="font-medium">{fixture.home_team_name}</td>
              <td className="font-medium">{fixture.away_team_name}</td>
              <td className="text-muted-ink">{formatLondonDateTime(fixture.kickoff_at)}</td>
              <td className="text-muted-ink">{fixture.fixture_status}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={onRevalidate} className="los-btn-secondary disabled:opacity-50">
          Revalidate draft snapshot
        </button>
        <button
          type="button"
          disabled={busy || !comparison.matchesMaster}
          onClick={onApprove}
          className="los-btn-primary disabled:opacity-50"
          title={comparison.matchesMaster ? undefined : 'Revalidate and resolve differences before approval'}
        >
          Approve and publish (later)
        </button>
        <button type="button" disabled={busy} onClick={onDefer} className="los-admin-btn disabled:opacity-50">
          Defer
        </button>
        <button type="button" disabled={busy} onClick={onReject} className="los-admin-btn disabled:opacity-50">
          Reject
        </button>
      </div>
    </div>
  )
}
