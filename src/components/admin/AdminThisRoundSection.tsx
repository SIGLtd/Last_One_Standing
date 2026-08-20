import { useState } from 'react'
import { Badge } from '../Badge'
import { formatDeadlineLondon, formatLondonDateTime } from '../../lib/fixtureOps'
import type { SelectionWindowEligibleFixture, SelectionWindowWithMeta } from '../../types'
import { ROUND1_PUBLIC_LABEL } from '../../lib/round1'

type AdminThisRoundSectionProps = {
  openWindow: SelectionWindowWithMeta
  fixtures: SelectionWindowEligibleFixture[]
  whatsAppSummary: string
  csvContents: string
}

export function AdminThisRoundSection({
  openWindow,
  fixtures,
  whatsAppSummary,
  csvContents,
}: AdminThisRoundSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
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
    link.download = 'round-1-selections.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

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
      <p className="mt-1 text-xs text-muted-ink">Deadline: {formatDeadlineLondon(openWindow.deadline_at)}</p>

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
