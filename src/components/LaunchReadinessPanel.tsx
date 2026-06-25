import { useState } from 'react'
import { formatGBP } from '../lib/constants'
import type { LaunchReadinessStats } from '../lib/preLaunch'
import { buildWhatsAppLaunchNotice } from '../lib/preLaunch'
import { Badge } from './Badge'
import { MetricCell, MetricStrip } from './MetricCell'

type LaunchReadinessPanelProps = {
  stats: LaunchReadinessStats
}

export function LaunchReadinessPanel({ stats }: LaunchReadinessPanelProps) {
  const [copied, setCopied] = useState(false)
  const whatsAppNotice = buildWhatsAppLaunchNotice()

  async function copyNotice() {
    await navigator.clipboard.writeText(whatsAppNotice)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="los-admin-section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="los-section-title">Launch readiness</h2>
        <Badge variant="muted">Read-only</Badge>
      </div>

      <MetricStrip className="mt-2">
        <MetricCell label="Registered players" value={stats.registeredPlayerCount} />
        <MetricCell label="Active paid entries" value={stats.activePaidEntryCount} />
        <MetricCell label="Awaiting verification" value={stats.awaitingVerificationCount} />
        <MetricCell label="Not yet active" value={stats.notYetActiveEntryCount} />
        <MetricCell label="Game 27 pot" value={formatGBP(stats.currentPot)} />
      </MetricStrip>

      <div className="mt-2 grid gap-1 text-xs text-muted-ink">
        <p>
          <span className="font-medium text-ink">Window 2:</span> {stats.window2Status}
        </p>
        <p>
          <span className="font-medium text-ink">Planned weekend:</span> {stats.plannedWeekend}
        </p>
        <p>
          <span className="font-medium text-ink">Next organiser action:</span> {stats.organiserNextAction}
        </p>
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <p className="los-section-title">WhatsApp launch notice</p>
        <pre className="mt-2 whitespace-pre-wrap rounded border border-border bg-surface p-2 text-[0.6875rem] text-muted-ink">
          {whatsAppNotice}
        </pre>
        <button type="button" onClick={() => void copyNotice()} className="mt-2 los-btn-secondary">
          {copied ? 'Copied' : 'Copy notice'}
        </button>
      </div>
    </section>
  )
}
