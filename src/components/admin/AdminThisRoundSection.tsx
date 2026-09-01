import { useMemo, useState } from 'react'
import { Badge } from '../Badge'
import { formatDeadlineLondon, formatLondonDateTime } from '../../lib/fixtureOps'
import { operationalWindowToRoundLabel } from '../../lib/round1'
import { inspectWeekendSnapshot, londonWeekdayLabel } from '../../lib/weekendSnapshot'
import { INVALID_WEEKDAY_SNAPSHOT_WARNING, isLosRoundEligibleFixture } from '../../lib/weekendFixtures'
import type { SeasonFixture, SelectionWindowEligibleFixture, SelectionWindowWithMeta } from '../../types'

type AdminThisRoundSectionProps = {
  openWindow: SelectionWindowWithMeta
  fixtures: SelectionWindowEligibleFixture[]
  seasonFixtures?: SeasonFixture[]
  whatsAppSummary: string
  csvContents: string
  stripBusy?: boolean
  onStripInvalidFixtures?: () => void
}

export function AdminThisRoundSection({
  openWindow,
  fixtures,
  seasonFixtures = [],
  whatsAppSummary,
  csvContents,
  stripBusy,
  onStripInvalidFixtures,
}: AdminThisRoundSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const roundLabel = operationalWindowToRoundLabel(openWindow.window_number)
  const seasonById = useMemo(() => new Map(seasonFixtures.map((row) => [row.id, row])), [seasonFixtures])
  const validity = useMemo(
    () =>
      inspectWeekendSnapshot(
        fixtures.map((fixture) => {
          const live = seasonById.get(fixture.season_fixture_id)
          return {
            season_fixture_id: fixture.season_fixture_id,
            home_team_id: fixture.home_team_id,
            away_team_id: fixture.away_team_id,
            kickoff_at: live?.kickoff_at || fixture.kickoff_at,
            eligibility_override: live?.eligibility_override ?? 'none',
            canonical_key: live?.canonical_key,
          }
        }),
      ),
    [fixtures, seasonById],
  )
  const preview = fixtures.slice(0, 4)
  const remainder = fixtures.length - preview.length

  async function copySummary() {
    await navigator.clipboard.writeText(whatsAppSummary)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  function downloadCsv() {
    const blob = new Blob([csvContents], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${roundLabel.replace(/\s+/g, '-').toLowerCase()}-selections.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function fixtureMeta(fixture: SelectionWindowEligibleFixture) {
    const live = seasonById.get(fixture.season_fixture_id)
    const kickoff = live?.kickoff_at || fixture.kickoff_at
    const eligible = isLosRoundEligibleFixture({
      kickoff_at: kickoff,
      eligibility_override: live?.eligibility_override ?? 'none',
      canonical_key: live?.canonical_key,
    })
    return { kickoff, eligible, day: londonWeekdayLabel(kickoff) }
  }

  function renderFixtureRow(fixture: SelectionWindowEligibleFixture) {
    const meta = fixtureMeta(fixture)
    return (
      <li key={fixture.id} className="rounded border border-border bg-surface px-2 py-2">
        <span className="font-medium text-ink">
          {fixture.home_team_name} v {fixture.away_team_name}
        </span>
        <span className="mt-0.5 block text-muted-ink">
          {meta.day} · {formatLondonDateTime(meta.kickoff)}
          {meta.eligible ? '' : ' · Invalid weekday'}
        </span>
      </li>
    )
  }

  return (
    <section className="los-admin-section los-cockpit-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="los-section-title">This round</h2>
        <Badge variant={validity.valid ? 'success' : 'warning'}>{roundLabel}</Badge>
      </div>

      <p className="mt-2 text-xs text-muted-ink">
        Official Premier League baseline current at publication. Communicate any material fixture changes on WhatsApp.
      </p>

      <p className="mt-1 text-xs text-muted-ink">
        Last revalidation:{' '}
        {openWindow.approved_at
          ? formatLondonDateTime(openWindow.approved_at)
          : formatLondonDateTime(openWindow.updated_at)}
      </p>
      <p className="mt-1 text-xs text-muted-ink">Deadline: {formatDeadlineLondon(openWindow.deadline_at)}</p>
      <p className="mt-1 text-xs text-muted-ink">
        {fixtures.length} fixture{fixtures.length === 1 ? '' : 's'} · {validity.saturdayCount} Saturday ·{' '}
        {validity.sundayCount} Sunday
        {openWindow.eligible_sat_date && openWindow.eligible_sun_date
          ? ` · ${openWindow.eligible_sat_date} to ${openWindow.eligible_sun_date}`
          : validity.weekendLabel
            ? ` · ${validity.weekendLabel}`
            : ''}
        {validity.valid ? ' · Snapshot valid' : ''}
      </p>
      {validity.issues.length > 0 ? (
        <div className="mt-2 los-alert los-alert-error">
          {validity.nonWeekend.length > 0 ? <p>{INVALID_WEEKDAY_SNAPSHOT_WARNING}</p> : null}
          {validity.issues
            .filter((issue) => issue !== INVALID_WEEKDAY_SNAPSHOT_WARNING)
            .map((issue) => (
              <p key={issue}>{issue}</p>
            ))}
          {onStripInvalidFixtures && validity.nonWeekend.length > 0 ? (
            <button
              type="button"
              onClick={onStripInvalidFixtures}
              disabled={stripBusy}
              className="mt-2 los-btn-secondary los-tap-target disabled:opacity-50"
            >
              {stripBusy ? 'Removing…' : 'Remove invalid fixtures'}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => void copySummary()} className="los-btn-secondary los-tap-target w-full sm:w-auto">
          {copied ? 'Copied' : 'Copy WhatsApp summary'}
        </button>
        <button type="button" onClick={downloadCsv} className="los-btn-secondary los-tap-target w-full sm:w-auto">
          Download CSV
        </button>
      </div>

      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-border bg-surface p-2 text-[0.6875rem] text-muted-ink">
        {whatsAppSummary}
      </pre>

      <ul className="mt-2 grid gap-1 text-xs">
        {preview.map((fixture) => renderFixtureRow(fixture))}
      </ul>

      {remainder > 0 && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 los-btn-secondary los-tap-target w-full"
        >
          View all {fixtures.length} fixtures
        </button>
      ) : null}

      {expanded ? (
        <ul className="mt-2 grid gap-1 text-xs">
          {fixtures.slice(4).map((fixture) => renderFixtureRow(fixture))}
        </ul>
      ) : null}
    </section>
  )
}
