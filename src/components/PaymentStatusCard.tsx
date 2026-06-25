import { BANK_DETAILS, formatGBP } from '../lib/constants'
import { Badge } from './Badge'
import { MetricCell, MetricStrip } from './MetricCell'
import type { EntryType, Game, GameEntry } from '../types'

function formatEntryType(entryType: EntryType) {
  switch (entryType) {
    case 'existing':
      return 'Returning (£10)'
    case 'newbie':
      return 'New (£30)'
    case 'admin_comp':
      return 'Comp (free)'
  }
}

function getPaymentStatusLabel(entry: GameEntry) {
  if (entry.paid) return 'Verified'
  if (entry.payment_claimed) return 'Awaiting verify'
  return 'Unpaid'
}

function getPaymentBadgeVariant(entry: GameEntry): 'success' | 'warning' | 'muted' {
  if (entry.paid) return 'success'
  if (entry.payment_claimed) return 'warning'
  return 'muted'
}

function getNextAction(entry: GameEntry | null, hasEntry: boolean) {
  if (!hasEntry || !entry) return 'Enter Game 27 on your dashboard, then pay by bank transfer.'
  if (entry.paid) return 'Return when the organiser opens the first live round to make your pick.'
  if (entry.payment_claimed) return 'Await admin payment verification on your dashboard.'
  return 'Pay by bank transfer on your dashboard, then mark as sent.'
}

type PaymentStatusCardProps = {
  game: Game
  entry: GameEntry | null
  claiming?: boolean
  creating?: boolean
  onClaimPayment?: () => void
  onCreateEntry?: () => void
}

export function PaymentStatusCard({
  game,
  entry,
  claiming = false,
  creating = false,
  onClaimPayment,
  onCreateEntry,
}: PaymentStatusCardProps) {
  const bankDetailsText = [
    BANK_DETAILS.bank,
    BANK_DETAILS.accountName,
    `Sort code: ${BANK_DETAILS.sortCode}`,
    `Account number: ${BANK_DETAILS.accountNumber}`,
  ].join('\n')

  async function copyBankDetails() {
    await navigator.clipboard.writeText(bankDetailsText)
  }

  return (
    <div className="grid gap-2 border-t border-border pt-3">
      <div className="los-section-title">Entry & payment</div>

      {entry ? (
        <MetricStrip>
          <MetricCell label="Entry type" value={formatEntryType(entry.entry_type)} />
          <MetricCell label="Amount due" value={formatGBP(entry.amount_due)} />
          <MetricCell
            label="Payment"
            value={<Badge variant={getPaymentBadgeVariant(entry)}>{getPaymentStatusLabel(entry)}</Badge>}
          />
        </MetricStrip>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted-ink">No entry for Game {game.game_number}.</span>
          {onCreateEntry ? (
            <button type="button" onClick={onCreateEntry} disabled={creating} className="los-btn-primary">
              {creating ? 'Creating…' : `Enter Game ${game.game_number}`}
            </button>
          ) : null}
        </div>
      )}

      {entry && !entry.paid ? (
        <div className="los-divider-list text-xs">
          <div className="los-divider-row los-section-title !text-[0.625rem]">Bank transfer</div>
          <div className="los-divider-row">{BANK_DETAILS.bank}</div>
          <div className="los-divider-row">{BANK_DETAILS.accountName}</div>
          <div className="los-divider-row tabular-nums">Sort {BANK_DETAILS.sortCode}</div>
          <div className="los-divider-row tabular-nums">Acct {BANK_DETAILS.accountNumber}</div>
          <div className="los-divider-row">
            <button type="button" onClick={() => void copyBankDetails()} className="los-btn-secondary">
              Copy details
            </button>
          </div>
        </div>
      ) : null}

      {entry && !entry.paid && !entry.payment_claimed && onClaimPayment ? (
        <button type="button" onClick={onClaimPayment} disabled={claiming} className="los-btn-primary w-fit">
          {claiming ? 'Updating…' : 'I have sent payment'}
        </button>
      ) : null}

      {entry?.payment_claimed && !entry.paid ? (
        <div className="los-alert los-alert-error">Payment marked sent. Awaiting admin verification.</div>
      ) : null}

      {entry?.paid ? (
        <div className="los-alert los-alert-success">Payment verified. Entered into Game {game.game_number}.</div>
      ) : null}

      <div className="text-xs text-muted-ink">
        <span className="los-section-title">Next · </span>
        {getNextAction(entry, Boolean(entry))}
      </div>
    </div>
  )
}
