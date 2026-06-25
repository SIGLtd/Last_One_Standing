import { formatLondonDateTime } from '../lib/fixtureOps'
import type { Window2ReadinessPreview } from '../lib/window2Preview'
import { Badge } from './Badge'
import { DataTable } from './DataTable'
import { MetricCell, MetricStrip } from './MetricCell'

type Window2ReadinessPreviewPanelProps = {
  preview: Window2ReadinessPreview
}

export function Window2ReadinessPreviewPanel({ preview }: Window2ReadinessPreviewPanelProps) {
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="los-section-title">Window 2 readiness preview</h3>
        <Badge variant="muted">Read-only · preview only</Badge>
      </div>

      <div className="mt-2 los-alert los-alert-warning text-xs">
        Preview only — no selection window has been created. Players cannot pick teams yet.
      </div>

      <p className="mt-2 text-xs text-muted-ink">
        Target weekend: Saturday {preview.targetSatDate} and Sunday {preview.targetSunDate} (
        {preview.timezone}). Calculated from live imported <code>season_fixtures</code>; no provider API calls.
      </p>

      {preview.warnings.length > 0 ? (
        <div className="mt-2 grid gap-1">
          {preview.warnings.map((warning) => (
            <div key={warning} className="los-alert los-alert-error text-xs">
              {warning}
            </div>
          ))}
        </div>
      ) : null}

      <MetricStrip className="mt-2">
        <MetricCell label="Eligible fixtures" value={preview.eligibleCount} />
        <MetricCell
          label="Earliest kick-off"
          value={preview.earliestEligibleKickoff ? formatLondonDateTime(preview.earliestEligibleKickoff) : '—'}
        />
        <MetricCell
          label="Proposed deadline"
          value={preview.proposedDeadline ? formatLondonDateTime(preview.proposedDeadline) : '—'}
        />
        <MetricCell label="Time zone" value={preview.timezone} />
      </MetricStrip>

      <p className="mt-2 text-xs text-muted-ink">
        Proposed player deadline is exactly one hour before the earliest eligible kick-off.
      </p>

      <DataTable minWidth="960px" className="mt-3">
        <thead>
          <tr>
            <th>Eligible</th>
            <th>Home</th>
            <th>Away</th>
            <th>Kick-off (UK)</th>
            <th>Status</th>
            <th>Source</th>
            <th>Provider ID</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {preview.reviewed.length === 0 ? (
            <tr>
              <td colSpan={8} className="text-muted-ink">
                No fixtures on the target weekend dates.
              </td>
            </tr>
          ) : (
            preview.reviewed.map((row) => (
              <tr key={row.fixture.id}>
                <td>{row.eligible ? <Badge variant="success">Yes</Badge> : <Badge variant="warning">No</Badge>}</td>
                <td className="font-medium">{row.fixture.home_team_name}</td>
                <td className="font-medium">{row.fixture.away_team_name}</td>
                <td className="text-muted-ink">{formatLondonDateTime(row.fixture.kickoff_at)}</td>
                <td className="text-muted-ink">{row.fixture.status}</td>
                <td className="text-muted-ink text-[0.6875rem]">{row.fixture.source_name}</td>
                <td className="text-muted-ink">{row.fixture.source_fixture_id ?? '—'}</td>
                <td className="text-muted-ink text-[0.6875rem]">{row.reason}</td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>
    </div>
  )
}
