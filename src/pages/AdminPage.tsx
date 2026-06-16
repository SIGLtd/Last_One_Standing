import { Card } from '../components/Card'

const sections = [
  { title: 'Current game summary', body: 'Scaffold only. Show Game 27 status, window state, alive/eliminated counts.' },
  { title: 'Player list', body: 'Placeholder for player management.' },
  { title: 'Payments', body: 'Placeholder for entry fees, payment statuses, and reconciliation.' },
  { title: 'Selection window', body: 'Placeholder for opening/locking windows and deadlines.' },
  { title: 'Manual selection correction', body: 'Placeholder for correcting picks before/after lock with audit trail.' },
  { title: 'Result resolution', body: 'Placeholder for manual resolution until automation is added.' },
  { title: 'Historical results management', body: 'Placeholder for editing seeded history data.' },
  { title: 'WhatsApp report generator', body: 'Placeholder. No WhatsApp integration in this milestone.' },
] as const

export function AdminPage() {
  return (
    <div className="grid gap-4">
      <Card
        title="Admin"
        description="Scaffold only. Policies and permissions will be tightened later."
        right={
          <span className="inline-flex items-center rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">
            Placeholder
          </span>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          {sections.map((s) => (
            <div key={s.title} className="rounded-xl border border-border bg-surface-2 p-3">
              <div className="text-sm font-semibold text-text">{s.title}</div>
              <div className="mt-1 text-sm text-muted">{s.body}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

