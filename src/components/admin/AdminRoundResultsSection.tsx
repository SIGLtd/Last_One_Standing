import { useMemo, useState } from 'react'
import { Badge } from '../Badge'
import { MetricCell, MetricStrip } from '../MetricCell'
import { TeamChip } from '../TeamChip'
import { TEAM_ID_TO_NAME } from '../../config/teams'
import { formatDeadlineLondon, formatLondonDateTime } from '../../lib/fixtureOps'
import { operationalWindowToRoundLabel } from '../../lib/round1'
import type { NextRoundWeekend } from '../../lib/nextRound'
import { survivalAuditGroupOpenByDefault } from '../../lib/survivalStatus'
import type { RoundResolutionPreview, RoundResolutionRow } from '../../lib/roundResolution'
import type { SelectionWindowWithMeta } from '../../types'

export type ResultSyncSummary = {
  lastSyncAt: string | null
  lastAttemptedAt?: string | null
  lastSuccessfulAt?: string | null
  fixturesChecked: number
  fixturesUpdated: number
  unresolved: Array<{ home_team_id?: string; away_team_id?: string; reason?: string }>
  ambiguousCount: number
  unmatchedCount: number
  missingFinalCount?: number
  providerErrors: string[]
  result?: string
}

type AdminRoundResultsSectionProps = {
  window: SelectionWindowWithMeta
  preview: RoundResolutionPreview
  fixtureCount: number
  syncSummary: ResultSyncSummary | null
  nextRound: {
    canOpen: boolean
    reason: string | null
    survivorCount: number
    alreadyOpen?: boolean
    weekend: NextRoundWeekend | null
  }
  deadlineValue: string
  onDeadlineChange: (value: string) => void
  syncBusy: boolean
  resolveBusy: boolean
  openBusy: boolean
  onSyncResults: () => void
  onResolveRound: () => void
  onOpenNextRound: () => void
  schedulerConfigured?: boolean
}

const GROUP_ORDER = ['survived', 'eliminated', 'no_pick', 'pending', 'withdrawn'] as const

const GROUP_TITLE: Record<(typeof GROUP_ORDER)[number], string> = {
  survived: 'Survived',
  eliminated: 'Eliminated 💀',
  no_pick: 'No pick 💀',
  pending: 'Pending / unresolved',
  withdrawn: 'Withdrawn / archived',
}

function teamLabel(teamId?: string | null) {
  if (!teamId) return 'Unknown team'
  return TEAM_ID_TO_NAME.get(teamId) ?? teamId
}

function outcomeText(row: RoundResolutionRow): string {
  if (row.outcomeReason === 'win') return 'Won'
  if (row.outcomeReason === 'loss') return 'Lost'
  if (row.outcomeReason === 'draw') return 'Drew'
  if (row.outcomeReason === 'no_pick') return 'No pick'
  if (row.outcomeReason === 'unresolved') return 'Awaiting result'
  if (row.group === 'withdrawn') return 'Not in live round'
  return row.outcome ?? '—'
}

function AuditGroup({
  group,
  title,
  rows,
}: {
  group: (typeof GROUP_ORDER)[number]
  title: string
  rows: RoundResolutionRow[]
}) {
  const [open, setOpen] = useState(() => survivalAuditGroupOpenByDefault(group, rows.length))

  return (
    <details
      className="los-audit-group"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="los-audit-summary los-tap-target">
        {title} ({rows.length})
      </summary>
      {rows.length === 0 ? (
        <p className="mt-1 px-1 text-xs text-muted-ink">None</p>
      ) : (
        <ul className="mt-1 grid gap-1">
          {rows.map((row) => (
            <AuditRow key={row.playerId} row={row} />
          ))}
        </ul>
      )}
    </details>
  )
}

function AuditRow({ row }: { row: RoundResolutionRow }) {
  return (
    <li className="flex items-start justify-between gap-2 rounded border border-border bg-surface px-2 py-2">
      <div className="min-w-0">
        <div className="font-medium text-ink">{row.displayName}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-ink">
          {row.teamId ? <TeamChip teamId={row.teamId} size="sm" /> : null}
          <span>{row.teamName}</span>
        </div>
        <div className="mt-0.5 text-[0.6875rem] text-muted-ink">
          {outcomeText(row)}
          {row.scoreLabel !== '—' ? ` · ${row.scoreLabel}` : ''}
          {row.usedFinal ? ' · Used / final' : ''}
        </div>
      </div>
    </li>
  )
}

export function AdminRoundResultsSection({
  window,
  preview,
  fixtureCount,
  syncSummary,
  nextRound,
  deadlineValue,
  onDeadlineChange,
  syncBusy,
  resolveBusy,
  openBusy,
  onSyncResults,
  onResolveRound,
  onOpenNextRound,
  schedulerConfigured = false,
}: AdminRoundResultsSectionProps) {
  const [confirmingResolve, setConfirmingResolve] = useState(false)
  const [confirmingOpen, setConfirmingOpen] = useState(false)
  const roundLabel = operationalWindowToRoundLabel(window.window_number)
  const grouped = useMemo(() => {
    return GROUP_ORDER.map((group) => ({
      group,
      title: GROUP_TITLE[group],
      rows: preview.rows.filter((row) => row.group === group),
    })).filter((section) => section.rows.length > 0 || section.group === 'survived' || section.group === 'eliminated')
  }, [preview.rows])

  const unresolvedLabels = (syncSummary?.unresolved ?? []).map((row) => {
    if (row.home_team_id && row.away_team_id) {
      return `${teamLabel(row.home_team_id)} v ${teamLabel(row.away_team_id)}: ${row.reason ?? 'Needs review'}`
    }
    return row.reason ?? 'Needs review'
  })

  return (
    <section className="los-admin-section los-cockpit-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="los-section-title">{roundLabel} results</h2>
        <Badge variant={preview.alreadyResolved ? 'success' : preview.readyToResolve ? 'open' : 'muted'}>
          {preview.alreadyResolved ? 'Resolved' : preview.readyToResolve ? 'Ready to resolve' : 'Waiting'}
        </Badge>
      </div>

      <p className="mt-2 text-xs text-muted-ink">
        Selected window {window.window_number} · {roundLabel} · {window.id} · deadline {formatDeadlineLondon(window.deadline_at)} ·{' '}
        {fixtureCount} fixture{fixtureCount === 1 ? '' : 's'}.
      </p>
      <p className="mt-1 text-xs text-muted-ink">
        Scores come from football-data.org. Syncing results does not eliminate anyone. Resolve only after you have
        reviewed the preview.
      </p>
      {schedulerConfigured ? (
        <p className="mt-1 text-xs text-muted-ink">A scheduled result sync secret is configured on the server.</p>
      ) : (
        <div className="mt-2 los-alert los-alert-warning">
          Result sync is admin-triggered. No scheduled weekend sync is active.
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="los-btn-primary los-tap-target w-full sm:w-auto disabled:opacity-50"
          onClick={onSyncResults}
          disabled={syncBusy}
        >
          {syncBusy ? 'Syncing…' : 'Sync latest results'}
        </button>
      </div>

      <MetricStrip className="mt-3">
        <MetricCell
          label="Last successful sync"
          value={syncSummary?.lastSuccessfulAt ? formatLondonDateTime(syncSummary.lastSuccessfulAt) : 'Not yet'}
        />
        <MetricCell
          label="Last attempted sync"
          value={
            syncSummary?.lastAttemptedAt || syncSummary?.lastSyncAt
              ? formatLondonDateTime(String(syncSummary.lastAttemptedAt ?? syncSummary.lastSyncAt))
              : 'Not since this weekend'
          }
        />
        <MetricCell label="Fixtures checked" value={syncSummary?.fixturesChecked ?? 0} />
        <MetricCell label="Fixtures updated" value={syncSummary?.fixturesUpdated ?? 0} />
      </MetricStrip>
      <MetricStrip className="mt-2">
        <MetricCell label="Still missing final scores" value={syncSummary?.missingFinalCount ?? syncSummary?.unresolved.length ?? 0} />
        <MetricCell label="Unresolved" value={syncSummary?.unresolved.length ?? 0} />
      </MetricStrip>

      {(syncSummary?.providerErrors.length ?? 0) > 0 ? (
        <div className="mt-2 los-alert los-alert-error">
          {(syncSummary?.providerErrors ?? []).map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      {unresolvedLabels.length > 0 ? (
        <ul className="mt-2 grid gap-1 text-xs text-muted-ink">
          {unresolvedLabels.slice(0, 8).map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      ) : null}

      {syncSummary?.ambiguousCount ? (
        <p className="mt-2 text-xs text-muted-ink">
          {syncSummary.ambiguousCount} provider match(es) need admin review and were not guessed.
        </p>
      ) : null}

      <h3 className="los-section-title mt-4">Resolution preview</h3>
      <MetricStrip className="mt-2">
        <MetricCell label="Active before" value={preview.activeEntrants} />
        <MetricCell label="Picks in" value={preview.picksSubmitted} />
        <MetricCell label="No picks" value={preview.noPicks} />
        <MetricCell label="Survivors" value={preview.survived} />
      </MetricStrip>
      <MetricStrip className="mt-2">
        <MetricCell label="Eliminated" value={preview.eliminated} />
        <MetricCell label="Pending" value={preview.pending} />
        <MetricCell label="Withdrawn" value={preview.withdrawn} />
      </MetricStrip>

      {preview.byTeam.length > 0 ? (
        <ul className="mt-2 grid gap-1 text-xs">
          {preview.byTeam.map((team) => (
            <li key={team.teamId} className="flex items-center gap-2">
              <TeamChip teamId={team.teamId} size="sm" />
              <span>
                {team.teamName}: {team.count} pick{team.count === 1 ? '' : 's'}
                {team.survived ? ` · ${team.survived} survived` : ''}
                {team.eliminated ? ` · ${team.eliminated} eliminated` : ''}
                {team.pending ? ` · ${team.pending} pending` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {preview.blockedReason ? <p className="mt-2 text-xs text-muted-ink">{preview.blockedReason}</p> : null}
      {preview.safetyIssues.length > 0 ? (
        <ul className="mt-2 grid gap-1 text-xs text-muted-ink">
          {preview.safetyIssues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}

      {confirmingResolve ? (
        <div className="mt-3 rounded border border-border bg-surface p-2">
          <p className="text-xs text-ink">
            Resolve {roundLabel}? {preview.survived} survive, {preview.eliminated + preview.noPicks} are eliminated.
            This does not change payments or player identities.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="los-btn-primary los-tap-target w-full sm:w-auto disabled:opacity-50"
              onClick={onResolveRound}
              disabled={resolveBusy}
            >
              {resolveBusy ? 'Resolving…' : 'Confirm resolve round'}
            </button>
            <button type="button" className="los-btn-secondary los-tap-target w-full sm:w-auto" onClick={() => setConfirmingResolve(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="mt-3 los-btn-primary los-tap-target w-full sm:w-auto disabled:opacity-50"
          onClick={() => setConfirmingResolve(true)}
          disabled={!preview.readyToResolve || resolveBusy}
        >
          Resolve round
        </button>
      )}

      <h3 className="los-section-title mt-4">Survival audit</h3>
      <div className="mt-2 grid gap-2">
        {grouped.map((section) => (
          <AuditGroup key={section.group} group={section.group} title={section.title} rows={section.rows} />
        ))}
      </div>

      <h3 className="los-section-title mt-4">Open next round</h3>
      <p className="mt-1 text-xs text-muted-ink">
        Open next round continues this game. Complete game closes it. Start new game creates the next game number.
      </p>
      {nextRound.survivorCount === 1 ? (
        <div className="mt-2 los-alert los-alert-warning">
          <p>This game has a winner. Complete the game before starting a new one.</p>
        </div>
      ) : null}
      {nextRound.weekend ? (
        <p className="mt-1 text-xs text-muted-ink">
          Next weekend: {nextRound.weekend.sat} to {nextRound.weekend.sun} · {nextRound.weekend.eligible.length}{' '}
          Saturday/Sunday fixtures · {nextRound.survivorCount} survivor{nextRound.survivorCount === 1 ? '' : 's'}
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-ink">{nextRound.reason ?? 'Next weekend is not ready yet.'}</p>
      )}
      {!nextRound.canOpen && nextRound.reason && !nextRound.alreadyOpen ? (
        <div className="mt-2 los-alert los-alert-error">
          <p>{nextRound.reason}</p>
        </div>
      ) : null}

      <label className="mt-2 grid gap-0.5">
        <span className="los-section-title">Deadline</span>
        <input
          className="los-input"
          type="datetime-local"
          value={deadlineValue}
          onChange={(event) => onDeadlineChange(event.target.value)}
          disabled={!nextRound.canOpen || openBusy}
        />
        {nextRound.weekend?.proposedDeadline ? (
          <span className="text-[0.6875rem] text-muted-ink">
            Proposed: {formatDeadlineLondon(nextRound.weekend.proposedDeadline)}
          </span>
        ) : null}
      </label>

      {confirmingOpen ? (
        <div className="mt-3 rounded border border-border bg-surface p-2">
          <p className="text-xs text-ink">
            Open the next round for {nextRound.survivorCount} survivor{nextRound.survivorCount === 1 ? '' : 's'} only?
            Eliminated players stay out.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="los-btn-primary los-tap-target w-full sm:w-auto disabled:opacity-50"
              onClick={onOpenNextRound}
              disabled={!nextRound.canOpen || openBusy}
            >
              {openBusy ? 'Opening…' : 'Confirm open next round'}
            </button>
            <button type="button" className="los-btn-secondary los-tap-target w-full sm:w-auto" onClick={() => setConfirmingOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="mt-3 los-btn-secondary los-tap-target w-full sm:w-auto disabled:opacity-50"
          onClick={() => setConfirmingOpen(true)}
          disabled={!nextRound.canOpen || openBusy}
        >
          Open next round
        </button>
      )}
    </section>
  )
}
