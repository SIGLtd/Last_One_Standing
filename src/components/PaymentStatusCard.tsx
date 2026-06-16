import { BANK_DETAILS, formatGBP } from '../lib/constants'
import { Badge } from './Badge'
import type { EntryType, Game, GameEntry } from '../types'

function formatEntryType(entryType: EntryType) {
  switch (entryType) {
    case 'existing':
      return 'Returning player (£10)'
    case 'newbie':
      return 'New player (£30)'
    case 'admin_comp':
      return 'Admin comp (free)'
  }
}

function getPaymentStatusLabel(entry: GameEntry) {
  if (entry.paid) {
    return 'Verified'
  }
  if (entry.payment_claimed) {
    return 'Claimed — awaiting verification'
  }
  return 'Unpaid'
}

function getPaymentBadgeVariant(entry: GameEntry): 'success' | 'warning' | 'muted' {
  if (entry.paid) return 'success'
  if (entry.payment_claimed) return 'warning'
  return 'muted'
}

function getNextAction(entry: GameEntry | null, hasEntry: boolean) {
  if (!hasEntry || !entry) {
    return 'Enter Game 27 to create your entry.'
  }
  if (entry.paid) {
    return 'Await selection window.'
  }
  if (entry.payment_claimed) {
    return 'Await admin verification.'
  }
  return 'Pay your entry by bank transfer and mark as sent.'
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
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="los-panel p-3">
          <div className="text-xs font-extrabold uppercase tracking-wide text-muted-ink">Current game</div>
          <div className="mt-1 text-xl font-extrabold text-purple">Game {game.game_number}</div>
          <div className="mt-3 text-xs font-extrabold uppercase tracking-wide text-muted-ink">Current pot</div>
          <div className="mt-1 text-lg font-bold text-ink">{formatGBP(game.current_pot)}</div>
        </div>

        {entry ? (
          <div className="los-panel p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-extrabold uppercase tracking-wide text-muted-ink">Payment status</div>
              <Badge variant={getPaymentBadgeVariant(entry)}>{getPaymentStatusLabel(entry)}</Badge>
            </div>
            <div className="mt-3 text-xs font-extrabold uppercase tracking-wide text-muted-ink">Entry type</div>
            <div className="mt-1 text-sm font-semibold text-ink">{formatEntryType(entry.entry_type)}</div>
            <div className="mt-3 text-xs font-extrabold uppercase tracking-wide text-muted-ink">Amount due</div>
            <div className="mt-1 text-lg font-extrabold text-purple">{formatGBP(entry.amount_due)}</div>
          </div>
        ) : (
          <div className="los-panel p-3">
            <div className="text-xs font-extrabold uppercase tracking-wide text-muted-ink">Entry</div>
            <div className="mt-1 text-sm text-muted-ink">You have not entered Game {game.game_number} yet.</div>
            {onCreateEntry ? (
              <button
                type="button"
                onClick={onCreateEntry}
                disabled={creating}
                className="los-btn-primary mt-3 h-10"
              >
                {creating ? 'Creating entry...' : `Enter Game ${game.game_number}`}
              </button>
            ) : null}
          </div>
        )}
      </div>

      {entry && !entry.paid ? (
        <div className="los-panel p-3">
          <div className="text-xs font-extrabold uppercase tracking-wide text-muted-ink">Bank transfer details</div>
          <div className="mt-2 grid gap-1 text-sm text-ink">
            <div>{BANK_DETAILS.bank}</div>
            <div>{BANK_DETAILS.accountName}</div>
            <div>Sort code: {BANK_DETAILS.sortCode}</div>
            <div>Account number: {BANK_DETAILS.accountNumber}</div>
          </div>
          <button type="button" onClick={() => void copyBankDetails()} className="los-btn-secondary mt-3 h-10">
            Copy bank details
          </button>
        </div>
      ) : null}

      {entry && !entry.paid && !entry.payment_claimed && onClaimPayment ? (
        <button
          type="button"
          onClick={onClaimPayment}
          disabled={claiming}
          className="los-btn-primary h-11 w-full sm:w-auto"
        >
          {claiming ? 'Updating...' : 'I have sent payment'}
        </button>
      ) : null}

      {entry?.payment_claimed && !entry.paid ? (
        <div className="los-alert los-alert-error">Payment marked as sent. Awaiting admin verification.</div>
      ) : null}

      {entry?.paid ? (
        <div className="los-alert los-alert-success">
          Payment verified. You are entered into Game {game.game_number}.
        </div>
      ) : null}

      <div className="los-panel p-3">
        <div className="text-xs font-extrabold uppercase tracking-wide text-muted-ink">Next action</div>
        <div className="mt-1 text-sm font-semibold text-ink">{getNextAction(entry, Boolean(entry))}</div>
      </div>
    </div>
  )
}
