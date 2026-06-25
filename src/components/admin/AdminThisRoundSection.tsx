import { useState } from 'react'
import { Badge } from '../Badge'
import { formatLondonDateTime } from '../../lib/fixtureOps'
import type { SelectionWindowEligibleFixture, SelectionWindowWithMeta } from '../../types'
import { ROUND1_PUBLIC_LABEL } from '../../lib/round1'

type AdminThisRoundSectionProps = {
  openWindow: SelectionWindowWithMeta
  fixtures: SelectionWindowEligibleFixture[]
}

export function AdminThisRoundSection({ openWindow, fixtures }: AdminThisRoundSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const preview = fixtures.slice(0, 4)
  const remainder = fixtures.length - preview.length

  return (
    <section className="los-admin-section los-cockpit-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="los-section-title">This round</h2>
        <Badge variant="success">{ROUND1_PUBLIC_LABEL}</Badge>
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

      <ul className="mt-2 grid gap-1 text-xs">
        {preview.map((fixture) => (
          <li key={fixture.id} className="rounded border border-border bg-surface px-2 py-2">
            <span className="font-medium text-ink">
              {fixture.home_team_name} v {fixture.away_team_name}
            </span>
            <span className="mt-0.5 block text-muted-ink">{formatLondonDateTime(fixture.kickoff_at)}</span>
          </li>
        ))}
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
          {fixtures.slice(4).map((fixture) => (
            <li key={fixture.id} className="rounded border border-border bg-surface px-2 py-2">
              <span className="font-medium text-ink">
                {fixture.home_team_name} v {fixture.away_team_name}
              </span>
              <span className="mt-0.5 block text-muted-ink">{formatLondonDateTime(fixture.kickoff_at)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
