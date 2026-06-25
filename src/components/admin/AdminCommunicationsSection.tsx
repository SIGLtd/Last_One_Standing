import { useState } from 'react'
import { buildWhatsAppDeadlineReminderNotice, buildWhatsAppRound1OpenNotice } from '../../lib/round1'

export function AdminCommunicationsSection() {
  const [copied, setCopied] = useState<'open' | 'deadline' | null>(null)
  const openNotice = buildWhatsAppRound1OpenNotice()
  const deadlineNotice = buildWhatsAppDeadlineReminderNotice()

  async function copyNotice(kind: 'open' | 'deadline') {
    const text = kind === 'open' ? openNotice : deadlineNotice
    await navigator.clipboard.writeText(text)
    setCopied(kind)
    window.setTimeout(() => setCopied(null), 2000)
  }

  return (
    <section className="los-admin-section los-cockpit-card">
      <h2 className="los-section-title">Communications</h2>

      <div className="mt-2 grid gap-3">
        <div>
          <p className="text-xs font-medium text-ink">Round 1 launch notice</p>
          <pre className="mt-2 whitespace-pre-wrap rounded border border-border bg-surface p-2 text-[0.6875rem] text-muted-ink">
            {openNotice}
          </pre>
          <button
            type="button"
            onClick={() => void copyNotice('open')}
            className="mt-2 los-btn-secondary los-tap-target w-full sm:w-auto"
          >
            {copied === 'open' ? 'Copied' : 'Copy launch notice'}
          </button>
        </div>

        <div>
          <p className="text-xs font-medium text-ink">Deadline reminder template</p>
          <pre className="mt-2 whitespace-pre-wrap rounded border border-border bg-surface p-2 text-[0.6875rem] text-muted-ink">
            {deadlineNotice}
          </pre>
          <button
            type="button"
            onClick={() => void copyNotice('deadline')}
            className="mt-2 los-btn-secondary los-tap-target w-full sm:w-auto"
          >
            {copied === 'deadline' ? 'Copied' : 'Copy deadline reminder'}
          </button>
        </div>
      </div>
    </section>
  )
}
