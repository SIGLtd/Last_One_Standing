import { BANK_DETAILS, formatGBP } from '../lib/constants'
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
        <div className="rounded-xl border border-border bg-surface-2 p-3">
          <div className="text-xs font-semibold text-muted">Current game</div>
          <div className="mt-1 text-sm text-text">Game {game.game_number}</div>
          <div className="mt-2 text-xs font-semibold text-muted">Current pot</div>
          <div className="mt-1 text-sm text-text">{formatGBP(game.current_pot)}</div>
        </div>

        {entry ? (
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="text-xs font-semibold text-muted">Entry type</div>
            <div className="mt-1 text-sm text-text">{formatEntryType(entry.entry_type)}</div>
            <div className="mt-2 text-xs font-semibold text-muted">Amount due</div>
            <div className="mt-1 text-sm font-semibold text-text">{formatGBP(entry.amount_due)}</div>
            <div className="mt-2 text-xs font-semibold text-muted">Payment status</div>
            <div className="mt-1 text-sm text-text">{getPaymentStatusLabel(entry)}</div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="text-xs font-semibold text-muted">Entry</div>
            <div className="mt-1 text-sm text-muted">You have not entered Game {game.game_number} yet.</div>
            {onCreateEntry ? (
              <button
                type="button"
                onClick={onCreateEntry}
                disabled={creating}
                className="mt-3 h-10 rounded-xl border border-accent bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-50"
              >
                {creating ? 'Creating entry...' : `Enter Game ${game.game_number}`}
              </button>
            ) : null}
          </div>
        )}
      </div>

      {entry && !entry.paid ? (
        <div className="rounded-xl border border-border bg-surface-2 p-3">
          <div className="text-xs font-semibold text-muted">Bank transfer details</div>
          <div className="mt-2 grid gap-1 text-sm text-text">
            <div>{BANK_DETAILS.bank}</div>
            <div>{BANK_DETAILS.accountName}</div>
            <div>Sort code: {BANK_DETAILS.sortCode}</div>
            <div>Account number: {BANK_DETAILS.accountNumber}</div>
          </div>
          <button
            type="button"
            onClick={() => void copyBankDetails()}
            className="mt-3 h-10 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-2"
          >
            Copy bank details
          </button>
        </div>
      ) : null}

      {entry && !entry.paid && !entry.payment_claimed && onClaimPayment ? (
        <button
          type="button"
          onClick={onClaimPayment}
          disabled={claiming}
          className="h-11 rounded-xl border border-accent bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-50"
        >
          {claiming ? 'Updating...' : 'I have sent payment'}
        </button>
      ) : null}

      {entry?.payment_claimed && !entry.paid ? (
        <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text">
          Payment marked as sent. Awaiting admin verification.
        </div>
      ) : null}

      {entry?.paid ? (
        <div className="rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm text-text">
          Payment verified. You are entered into Game {game.game_number}.
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-surface-2 p-3">
        <div className="text-xs font-semibold text-muted">Next action</div>
        <div className="mt-1 text-sm text-text">{getNextAction(entry, Boolean(entry))}</div>
      </div>
    </div>
  )
}
