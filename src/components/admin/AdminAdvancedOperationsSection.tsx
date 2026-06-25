import { Badge } from '../Badge'
import { DataTable } from '../DataTable'
import { Window2DraftPanel } from '../Window2DraftPanel'
import { Window2ReadinessPreviewPanel } from '../Window2ReadinessPreviewPanel'
import { formatEligibleSelectionDays, formatGBP } from '../../lib/constants'
import { formatLondonDateTime } from '../../lib/fixtureOps'
import { PROVIDER_STATUS_COPY } from '../../lib/round1'
import type { Window2ReadinessPreview } from '../../lib/window2Preview'
import type { DraftSnapshotComparison } from '../../lib/window2Draft'
import type {
  EntryType,
  FixtureChangeEvent,
  FixtureSyncRun,
  Game,
  GameEntryWithPlayer,
  SelectionWindowEligibleFixture,
  SelectionWindowWithMeta,
  SeasonFixture,
} from '../../types'

type AdminAdvancedOperationsSectionProps = {
  game: Game | null
  entries: GameEntryWithPlayer[]
  windows: SelectionWindowWithMeta[]
  candidates: SelectionWindowWithMeta[]
  candidateFixtures: Record<string, SelectionWindowEligibleFixture[]>
  syncRuns: FixtureSyncRun[]
  changeAlerts: FixtureChangeEvent[]
  window2Preview: Window2ReadinessPreview | null
  seasonFixtures: SeasonFixture[]
  providerConfigured: boolean
  schedulerConfigured: boolean
  openWindow: SelectionWindowWithMeta | null
  window2Draft: SelectionWindowWithMeta | null
  window2Comparison: DraftSnapshotComparison | null
  window2Snapshot: SelectionWindowEligibleFixture[]
  fixtureBusy: boolean
  actionId: string | null
  testSatDate: string
  testSunDate: string
  onTestSatDateChange: (value: string) => void
  onTestSunDateChange: (value: string) => void
  onReconcile: (testWeekend: boolean) => void
  onLockOpenWindow: () => void
  onRevalidateDraft: (windowId: string) => void
  onApproveCandidate: (windowId: string) => void
  onReviewCandidate: (windowId: string, outcome: 'deferred' | 'rejected') => void
  onVerifyPayment: (entryId: string) => void
  onSetEntryType: (entryId: string, entryType: EntryType) => void
}

export function AdminAdvancedOperationsSection({
  game,
  windows,
  candidates,
  candidateFixtures,
  syncRuns,
  changeAlerts,
  window2Preview,
  providerConfigured,
  schedulerConfigured,
  openWindow,
  window2Draft,
  window2Comparison,
  window2Snapshot,
  fixtureBusy,
  actionId,
  testSatDate,
  testSunDate,
  onTestSatDateChange,
  onTestSunDateChange,
  onReconcile,
  onLockOpenWindow,
  onRevalidateDraft,
  onApproveCandidate,
  onReviewCandidate,
}: AdminAdvancedOperationsSectionProps) {
  const otherCandidates = candidates.filter((candidate) => candidate.window_number !== 2)

  return (
    <details className="los-admin-section los-cockpit-card">
      <summary className="los-tap-target cursor-pointer text-sm font-semibold text-ink">
        Advanced operations
        <span className="mt-1 block text-xs font-normal text-muted-ink">
          Exceptional organiser use only — provider status, reconciliation, historic Window 1, and diagnostics.
        </span>
      </summary>

      <div className="mt-3 grid gap-3">
        <section>
          <h3 className="los-section-title">Provider status</h3>
          <ul className="mt-2 grid gap-1 text-xs text-muted-ink">
            <li>{PROVIDER_STATUS_COPY.officialBaseline}</li>
            <li>
              {providerConfigured
                ? PROVIDER_STATUS_COPY.footballDataConnection
                : PROVIDER_STATUS_COPY.footballDataConnectionMissing}
            </li>
            <li>{PROVIDER_STATUS_COPY.scheduleMappingUnavailable}</li>
            <li>{PROVIDER_STATUS_COPY.automatedDetectionInactive}</li>
            <li>Scheduled jobs: {schedulerConfigured ? 'credentials present' : 'not enabled'}</li>
          </ul>
        </section>

        {game ? (
          <section>
            <h3 className="los-section-title">Game diagnostics</h3>
            <p className="mt-1 text-xs text-muted-ink">
              Game {game.game_number} · {game.season} · pot {formatGBP(game.current_pot)}
            </p>
          </section>
        ) : null}

        <section>
          <h3 className="los-section-title">Fixture operations</h3>
          <p className="mt-1 text-xs text-muted-ink">
            {formatEligibleSelectionDays()} windows only. Window 1 is a protected historic placeholder.
          </p>

          {windows.some((w) => w.window_number === 1) ? (
            <div className="mt-2 los-notice text-xs">Protected historic window #1 — no operational actions permitted.</div>
          ) : null}

          {window2Preview ? <Window2ReadinessPreviewPanel preview={window2Preview} /> : null}

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={fixtureBusy}
              onClick={() => onReconcile(false)}
              className="los-btn-secondary los-tap-target disabled:opacity-50"
            >
              {fixtureBusy ? 'Running…' : 'Run reconciliation'}
            </button>
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-0.5">
              <span className="los-section-title">Test Saturday</span>
              <input
                type="date"
                value={testSatDate}
                onChange={(e) => onTestSatDateChange(e.target.value)}
                className="los-input !h-11"
              />
            </label>
            <label className="grid gap-0.5">
              <span className="los-section-title">Test Sunday</span>
              <input
                type="date"
                value={testSunDate}
                onChange={(e) => onTestSunDateChange(e.target.value)}
                className="los-input !h-11"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={fixtureBusy || !testSatDate || !testSunDate}
            onClick={() => onReconcile(true)}
            className="mt-2 los-btn-secondary los-tap-target disabled:opacity-50"
          >
            Run test weekend reconciliation
          </button>

          {changeAlerts.length > 0 ? (
            <div className="mt-2 los-alert los-alert-error text-xs">
              {changeAlerts.length} material fixture change alert(s) require organiser review.
            </div>
          ) : null}

          {openWindow ? (
            <div className="mt-2 los-notice text-xs">
              Open window #{openWindow.window_number} · deadline {formatLondonDateTime(openWindow.deadline_at)}
              <button type="button" onClick={onLockOpenWindow} className="ml-2 los-admin-btn los-tap-target">
                Lock now
              </button>
            </div>
          ) : null}

          {window2Draft && window2Comparison ? (
            <Window2DraftPanel
              draftWindow={window2Draft}
              snapshotFixtures={window2Snapshot}
              comparison={window2Comparison}
              busy={actionId === window2Draft.id}
              onRevalidate={() => onRevalidateDraft(window2Draft.id)}
              onApprove={() => onApproveCandidate(window2Draft.id)}
              onDefer={() => onReviewCandidate(window2Draft.id, 'deferred')}
              onReject={() => onReviewCandidate(window2Draft.id, 'rejected')}
            />
          ) : null}

          {otherCandidates.map((candidate) => {
            const fixtures = candidateFixtures[candidate.id] ?? []
            const busy = actionId === candidate.id
            return (
              <div key={candidate.id} className="mt-2 border-t border-border pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-medium text-ink">
                    Candidate window #{candidate.window_number} · {candidate.eligible_sat_date} –{' '}
                    {candidate.eligible_sun_date}
                  </div>
                  <Badge variant="warning">pending review</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-ink">
                  Deadline {formatLondonDateTime(candidate.deadline_at)} · {fixtures.length} fixtures
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onApproveCandidate(candidate.id)}
                    className="los-admin-btn disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onReviewCandidate(candidate.id, 'deferred')}
                    className="los-admin-btn disabled:opacity-50"
                  >
                    Defer
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onReviewCandidate(candidate.id, 'rejected')}
                    className="los-admin-btn disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )
          })}

          {syncRuns.length > 0 ? (
            <div className="mt-2 text-xs text-muted-ink">
              Latest sync: {syncRuns[0].run_result} · {syncRuns[0].validation_status} · {syncRuns[0].fixture_total}{' '}
              fixtures
            </div>
          ) : null}
        </section>

        {syncRuns.length > 0 ? (
          <section>
            <h3 className="los-section-title">Recent sync runs</h3>
            <div className="hidden md:block">
              <DataTable minWidth="640px">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Result</th>
                    <th>Validation</th>
                    <th className="num">Fixtures</th>
                  </tr>
                </thead>
                <tbody>
                  {syncRuns.map((run) => (
                    <tr key={run.id}>
                      <td>{formatLondonDateTime(run.created_at)}</td>
                      <td>{run.run_result}</td>
                      <td>{run.validation_status}</td>
                      <td className="num tabular-nums">{run.fixture_total}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          </section>
        ) : null}
      </div>
    </details>
  )
}
