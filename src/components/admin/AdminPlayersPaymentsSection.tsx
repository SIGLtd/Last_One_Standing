import { MetricCell, MetricStrip } from '../MetricCell'
import { DataTable } from '../DataTable'
import type { EntryType, GameEntryWithPlayer } from '../../types'
import { formatGBP } from '../../lib/constants'

type AdminPlayersPaymentsSectionProps = {
  entries: GameEntryWithPlayer[]
  summary: {
    registered: number
    activePaid: number
    awaitingVerification: number
    notActive: number
  }
  actionId: string | null
  onVerifyPayment: (entryId: string) => void
  onSetEntryType: (entryId: string, entryType: EntryType) => void
}

function formatEntryType(entryType: EntryType) {
  switch (entryType) {
    case 'existing':
      return 'Returning'
    case 'newbie':
      return 'Newbie'
    case 'admin_comp':
      return 'Admin comp'
  }
}

export function AdminPlayersPaymentsSection({
  entries,
  summary,
  actionId,
  onVerifyPayment,
  onSetEntryType,
}: AdminPlayersPaymentsSectionProps) {
  const awaiting = entries.filter((entry) => entry.payment_claimed && !entry.paid)

  return (
    <section id="players-payments" className="los-admin-section los-cockpit-card">
      <h2 className="los-section-title">Players and payments</h2>

      <MetricStrip className="mt-2">
        <MetricCell label="Registered" value={summary.registered} />
        <MetricCell label="Active paid" value={summary.activePaid} />
        <MetricCell label="Awaiting verify" value={summary.awaitingVerification} />
        <MetricCell label="Not active" value={summary.notActive} />
      </MetricStrip>

      {awaiting.length > 0 ? (
        <div className="mt-3 grid gap-2">
          <p className="text-xs font-medium text-ink">Awaiting verification</p>
          {awaiting.map((entry) => {
            const busy = actionId === entry.id
            return (
              <div key={entry.id} className="rounded border border-border bg-surface p-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink">{entry.player.display_name}</span>
                  <span className="text-muted-ink">{formatGBP(entry.amount_due)}</span>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onVerifyPayment(entry.id)}
                  className="mt-2 los-btn-primary los-tap-target w-full disabled:opacity-50"
                >
                  {busy ? 'Verifying…' : 'Verify payment'}
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-ink">No entries awaiting payment verification.</p>
      )}

      <details className="mt-3">
        <summary className="los-tap-target cursor-pointer text-xs font-medium text-ink">All entries</summary>
        <div className="mt-2 hidden md:block">
          <DataTable minWidth="880px">
            <thead>
              <tr>
                <th>Player</th>
                <th>Type</th>
                <th className="num">Due</th>
                <th>Claimed</th>
                <th>Paid</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => {
                const busy = actionId === row.id
                return (
                  <tr key={row.id}>
                    <td className="font-medium">{row.player.display_name}</td>
                    <td className="text-muted-ink">{formatEntryType(row.entry_type)}</td>
                    <td className="num tabular-nums">{formatGBP(row.amount_due)}</td>
                    <td className="text-muted-ink">{row.payment_claimed ? 'Y' : 'N'}</td>
                    <td className="text-muted-ink">{row.paid ? 'Y' : 'N'}</td>
                    <td className="text-muted-ink">{row.status}</td>
                    <td>
                      <div className="flex flex-wrap gap-0.5">
                        {!row.paid ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onVerifyPayment(row.id)}
                            className="los-admin-btn disabled:opacity-50"
                          >
                            Verify
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onSetEntryType(row.id, 'existing')}
                          className="los-admin-btn disabled:opacity-50"
                        >
                          Existing
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onSetEntryType(row.id, 'newbie')}
                          className="los-admin-btn disabled:opacity-50"
                        >
                          Newbie
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onSetEntryType(row.id, 'admin_comp')}
                          className="los-admin-btn disabled:opacity-50"
                        >
                          Comp
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </DataTable>
        </div>

        <div className="mt-2 grid gap-2 md:hidden">
          {entries.map((row) => {
            const busy = actionId === row.id
            return (
              <div key={row.id} className="rounded border border-border bg-surface p-2 text-xs">
                <div className="font-medium text-ink">{row.player.display_name}</div>
                <div className="mt-1 text-muted-ink">
                  {formatEntryType(row.entry_type)} · {formatGBP(row.amount_due)} · {row.status}
                </div>
                {!row.paid ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onVerifyPayment(row.id)}
                    className="mt-2 los-btn-secondary los-tap-target w-full disabled:opacity-50"
                  >
                    Verify
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      </details>
    </section>
  )
}
