import { useEffect, useState } from 'react'
import { ButtonLink } from '../ButtonLink'
import { Badge } from '../Badge'
import { MetricCell, MetricStrip } from '../MetricCell'
import { formatDeadlineLondon } from '../../lib/fixtureOps'
import { formatGBP } from '../../lib/constants'
import type { RoundControlStats } from '../../lib/adminCockpit'

type AdminRoundControlCardProps = {
  stats: RoundControlStats
  currentPot: number
  potBusy?: boolean
  onSavePot?: (value: number) => void
}

export function AdminRoundControlCard({ stats, currentPot, potBusy, onSavePot }: AdminRoundControlCardProps) {
  const [potInput, setPotInput] = useState(String(currentPot))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setPotInput(String(currentPot))
  }, [currentPot])

  return (
    <section className="los-admin-section los-cockpit-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="los-section-title">{stats.roundLabel} control</h2>
        <Badge variant="open">{stats.statusLabel}</Badge>
      </div>

      <MetricStrip className="mt-2">
        <MetricCell label="Deadline" value={formatDeadlineLondon(stats.deadlineLabel)} />
        <MetricCell label="Time left" value={stats.timeRemaining} />
        <MetricCell label="Fixtures" value={stats.eligibleFixtureCount} />
        <MetricCell label="Picks in" value={stats.selectionsMade} />
      </MetricStrip>

      <MetricStrip className="mt-2">
        <MetricCell label="Paid active" value={stats.paidActivePlayers} />
        <MetricCell label="Awaiting verify" value={stats.awaitingVerification} />
        <MetricCell label="Displayed pot" value={formatGBP(currentPot)} />
      </MetricStrip>

      {onSavePot ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const next = Number(potInput.replace(/[£,]/g, ''))
            if (!Number.isFinite(next) || next < 0) return
            onSavePot(Math.round(next))
            setSaved(true)
            window.setTimeout(() => setSaved(false), 2000)
          }}
        >
          <label className="grid gap-0.5">
            <span className="los-section-title">Update pot</span>
            <input
              className="los-input w-32"
              value={potInput}
              onChange={(event) => setPotInput(event.target.value)}
              inputMode="numeric"
              disabled={potBusy}
            />
          </label>
          <button type="submit" disabled={potBusy} className="los-btn-primary los-tap-target disabled:opacity-50">
            {potBusy ? 'Saving…' : saved ? 'Saved' : 'Save pot'}
          </button>
        </form>
      ) : null}

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
