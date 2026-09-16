import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../Badge'
import { MetricCell, MetricStrip } from '../MetricCell'
import { formatGBP } from '../../lib/constants'
import {
  ROLLOVER_COPY,
  WINNER_PAID_COPY,
  GAME_HAS_WINNER_COPY,
  completeGameWarning,
  defaultOpeningPotForNewGame,
  defaultPrizePaid,
  defaultRolloverAmount,
  gameHasDetectedWinner,
  homeRolloverOpeningLabel,
  isCompletedGame,
  isLiveGameStatus,
  isRolloverCompletion,
  isWinnerPaid,
  nextGameNumber,
  survivingEntries,
  validateCompleteGame,
  type CompleteGameDraft,
} from '../../lib/gameLifecycle'
import type { NextRoundWeekend } from '../../lib/nextRound'
import { formatDeadlineLondon } from '../../lib/fixtureOps'
import type { CompletionType, Game, GameEntryWithPlayer } from '../../types'

export type CompleteGameSubmit = {
  completionType: CompletionType
  winnerPlayerId: string | null
  finalPot: number
  prizePaidAmount: number
  rolloverAmount: number
  notes: string
  nonSurvivorReason: string
}

export type StartNewGameSubmit = {
  gameNumber: number
  openingPot: number
  carryForwardPlayers: boolean
  season: string
}

type AdminGameStatusSectionProps = {
  game: Game
  entries: GameEntryWithPlayer[]
  firstRound: {
    canOpen: boolean
    reason: string | null
    alreadyOpen?: boolean
    weekend: NextRoundWeekend | null
  }
  firstRoundDeadline: string
  onFirstRoundDeadlineChange: (value: string) => void
  showFirstRound: boolean
  busy: boolean
  onComplete: (input: CompleteGameSubmit) => void
  onStartNewGame: (input: StartNewGameSubmit) => void
  onOpenFirstRound: () => void
}

export function AdminGameStatusSection({
  game,
  entries,
  firstRound,
  firstRoundDeadline,
  onFirstRoundDeadlineChange,
  showFirstRound,
  busy,
  onComplete,
  onStartNewGame,
  onOpenFirstRound,
}: AdminGameStatusSectionProps) {
  const survivors = useMemo(() => survivingEntries(entries), [entries])
  const hasWinner = gameHasDetectedWinner(survivors.length)
  const completed = isCompletedGame(game)
  const live = isLiveGameStatus(game.status)

  const [completionType, setCompletionType] = useState<CompletionType>(hasWinner ? 'winner_paid' : 'rollover')
  const [winnerPlayerId, setWinnerPlayerId] = useState(survivors[0]?.player_id ?? '')
  const [finalPot, setFinalPot] = useState(String(game.current_pot))
  const [prizePaid, setPrizePaid] = useState(String(defaultPrizePaid(game.current_pot)))
  const [rolloverAmount, setRolloverAmount] = useState(String(defaultRolloverAmount(game.current_pot)))
  const [notes, setNotes] = useState('')
  const [nonSurvivorReason, setNonSurvivorReason] = useState('')
  const [confirmingComplete, setConfirmingComplete] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)

  const [newGameNumber, setNewGameNumber] = useState(String(nextGameNumber(game.game_number)))
  const [openingPot, setOpeningPot] = useState(String(defaultOpeningPotForNewGame(game)))
  const [carryForward, setCarryForward] = useState(true)
  const [confirmingStart, setConfirmingStart] = useState(false)
  const [confirmingFirstRound, setConfirmingFirstRound] = useState(false)

  useEffect(() => {
    setFinalPot(String(game.current_pot))
    setPrizePaid(String(defaultPrizePaid(game.current_pot)))
    setRolloverAmount(String(defaultRolloverAmount(game.current_pot)))
    setNewGameNumber(String(nextGameNumber(game.game_number)))
    setOpeningPot(String(defaultOpeningPotForNewGame(game)))
    if (survivors[0]?.player_id) setWinnerPlayerId(survivors[0].player_id)
  }, [game.id, game.current_pot, game.game_number, game.result_type, game.status, survivors])

  const winnerIsSurvivor = survivors.some((entry) => entry.player_id === winnerPlayerId)
  const parsedFinalPot = Number(finalPot)
  const parsedPrize = Number(prizePaid)
  const parsedRollover = Number(rolloverAmount)
  const parsedOpeningPot = Number(openingPot)
  const parsedGameNumber = Number(newGameNumber)

  const draft: CompleteGameDraft = {
    completionType,
    winnerPlayerId: completionType === 'winner_paid' ? winnerPlayerId || null : null,
    winnerIsSurvivor,
    nonSurvivorReason,
    finalPot: Number.isFinite(parsedFinalPot) ? parsedFinalPot : -1,
    prizePaidAmount: Number.isFinite(parsedPrize) ? parsedPrize : -1,
    rolloverAmount: completionType === 'winner_paid' ? 0 : Number.isFinite(parsedRollover) ? parsedRollover : -1,
    notes,
    currentPot: game.current_pot,
    gameStatus: game.status,
  }
  const validation = validateCompleteGame(draft)

  function handleConfirmComplete() {
    setCompleteError(null)
    if (!validation.ok) {
      setCompleteError(validation.error)
      return
    }
    onComplete({
      completionType: validation.value.completionType,
      winnerPlayerId: validation.value.winnerPlayerId,
      finalPot: validation.value.finalPot,
      prizePaidAmount: validation.value.prizePaidAmount,
      rolloverAmount: validation.value.rolloverAmount,
      notes: validation.value.notes,
      nonSurvivorReason: validation.value.nonSurvivorReason ?? '',
    })
  }

  const rolloverLabel = homeRolloverOpeningLabel(game)

  return (
    <section className="los-admin-section los-cockpit-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="los-section-title">Game status</h2>
        <Badge variant={completed ? 'success' : hasWinner ? 'open' : 'muted'}>
          {completed ? (isRolloverCompletion(game) ? 'Rollover' : 'Complete') : hasWinner ? 'Winner detected' : game.status}
        </Badge>
      </div>

      <p className="mt-2 text-xs text-muted-ink">
        Game {game.game_number} · {game.season} · pot {formatGBP(game.current_pot)}
      </p>
      {hasWinner && live ? (
        <div className="mt-2 los-alert los-alert-warning">
          <p>{GAME_HAS_WINNER_COPY}</p>
        </div>
      ) : null}
      {completed && isWinnerPaid(game) ? (
        <p className="mt-2 text-sm text-ink">
          Winner: {game.winner_display_name ?? 'Winner'} · Prize paid: {formatGBP(game.prize_paid_amount ?? game.final_pot ?? game.current_pot)}
        </p>
      ) : null}
      {completed && isRolloverCompletion(game) ? (
        <p className="mt-2 text-sm text-ink">No winner — pot rolls over · {formatGBP(game.rollover_amount ?? game.current_pot)}</p>
      ) : null}
      {rolloverLabel ? <p className="mt-2 text-xs text-muted-ink">{rolloverLabel}</p> : null}

      {live ? (
        <>
          <h3 className="los-section-title mt-4">Complete Game {game.game_number}</h3>
          <fieldset className="mt-2 grid gap-2" disabled={busy}>
            <legend className="sr-only">Completion type</legend>
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="radio"
                name="completion-type"
                checked={completionType === 'winner_paid'}
                onChange={() => {
                  setCompletionType('winner_paid')
                  setCompleteError(null)
                }}
              />
              <span>
                <strong>Winner paid</strong>
                <span className="mt-0.5 block text-xs text-muted-ink">{WINNER_PAID_COPY}</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="radio"
                name="completion-type"
                checked={completionType === 'rollover'}
                onChange={() => {
                  setCompletionType('rollover')
                  setWinnerPlayerId('')
                  setCompleteError(null)
                }}
              />
              <span>
                <strong>Rollover</strong>
                <span className="mt-0.5 block text-xs text-muted-ink">{ROLLOVER_COPY}</span>
              </span>
            </label>
          </fieldset>

          {completionType === 'winner_paid' ? (
            <label className="mt-2 grid gap-0.5">
              <span className="los-section-title">Winner</span>
              <select
                className="los-input"
                value={winnerPlayerId}
                disabled={busy}
                onChange={(event) => setWinnerPlayerId(event.target.value)}
              >
                <option value="">Select winner</option>
                {survivors.map((entry) => (
                  <option key={entry.player_id} value={entry.player_id}>
                    {entry.player?.display_name ?? 'Player'} (final survivor)
                  </option>
                ))}
                {entries
                  .filter((entry) => !survivors.some((survivor) => survivor.player_id === entry.player_id))
                  .map((entry) => (
                    <option key={entry.player_id} value={entry.player_id}>
                      {entry.player?.display_name ?? 'Player'} (not a final survivor)
                    </option>
                  ))}
              </select>
            </label>
          ) : null}

          {completionType === 'winner_paid' && winnerPlayerId && !winnerIsSurvivor ? (
            <label className="mt-2 grid gap-0.5">
              <span className="los-section-title">Reason for non-survivor winner</span>
              <textarea
                className="los-input min-h-16"
                value={nonSurvivorReason}
                disabled={busy}
                onChange={(event) => setNonSurvivorReason(event.target.value)}
              />
            </label>
          ) : null}

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-0.5">
              <span className="los-section-title">Final pot</span>
              <input
                className="los-input"
                value={finalPot}
                inputMode="numeric"
                disabled={busy}
                onChange={(event) => {
                  setFinalPot(event.target.value)
                  const next = Number(event.target.value.replace(/[£,]/g, ''))
                  if (Number.isFinite(next) && completionType === 'winner_paid') setPrizePaid(String(defaultPrizePaid(next)))
                }}
              />
            </label>
            {completionType === 'winner_paid' ? (
              <label className="grid gap-0.5">
                <span className="los-section-title">Prize paid</span>
                <input className="los-input" value={prizePaid} inputMode="numeric" disabled={busy} onChange={(event) => setPrizePaid(event.target.value)} />
              </label>
            ) : (
              <label className="grid gap-0.5">
                <span className="los-section-title">Rollover amount</span>
                <input
                  className="los-input"
                  value={rolloverAmount}
                  inputMode="numeric"
                  disabled={busy}
                  onChange={(event) => setRolloverAmount(event.target.value)}
                />
              </label>
            )}
          </div>

          <label className="mt-2 grid gap-0.5">
            <span className="los-section-title">{completionType === 'rollover' ? 'Reason / notes' : 'Notes (optional)'}</span>
            <textarea className="los-input min-h-16" value={notes} disabled={busy} onChange={(event) => setNotes(event.target.value)} />
          </label>

          {completeError ? <div className="mt-2 los-alert los-alert-error">{completeError}</div> : null}

          {confirmingComplete ? (
            <div className="mt-3 rounded border border-border bg-surface p-2">
              <p className="text-xs text-ink">
                Complete Game {game.game_number} as {completionType === 'winner_paid' ? 'Winner paid' : 'Rollover'}
                {completionType === 'winner_paid' && winnerPlayerId
                  ? ` · Winner ${entries.find((entry) => entry.player_id === winnerPlayerId)?.player?.display_name ?? 'selected player'}`
                  : ''}
                {` · Final pot ${formatGBP(Number.isFinite(parsedFinalPot) ? parsedFinalPot : 0)}`}
                {completionType === 'winner_paid'
                  ? ` · Prize paid ${formatGBP(Number.isFinite(parsedPrize) ? parsedPrize : 0)}`
                  : ` · Rollover ${formatGBP(Number.isFinite(parsedRollover) ? parsedRollover : 0)}`}
                .
              </p>
              <p className="mt-1 text-xs text-muted-ink">{completeGameWarning(game.game_number)}</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <button type="button" className="los-btn-primary los-tap-target disabled:opacity-50" disabled={busy} onClick={handleConfirmComplete}>
                  {busy ? 'Completing…' : `Complete Game ${game.game_number}`}
                </button>
                <button type="button" className="los-btn-secondary los-tap-target" disabled={busy} onClick={() => setConfirmingComplete(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="mt-3 los-btn-primary los-tap-target w-full sm:w-auto disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                setCompleteError(null)
                setConfirmingComplete(true)
              }}
            >
              Complete Game {game.game_number}
            </button>
          )}
        </>
      ) : null}

      {completed ? (
        <>
          <h3 className="los-section-title mt-4">Start new game</h3>
          <p className="mt-1 text-xs text-muted-ink">
            Creates Game {Number.isFinite(parsedGameNumber) ? parsedGameNumber : nextGameNumber(game.game_number)} without copying picks or eliminated status.
            {isRolloverCompletion(game)
              ? ` Default opening pot is the rollover from Game ${game.game_number}.`
              : ' Default opening pot is £0 because the previous game was winner paid.'}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-0.5">
              <span className="los-section-title">Game number</span>
              <input className="los-input" value={newGameNumber} inputMode="numeric" disabled={busy} onChange={(event) => setNewGameNumber(event.target.value)} />
            </label>
            <label className="grid gap-0.5">
              <span className="los-section-title">Opening pot</span>
              <input className="los-input" value={openingPot} inputMode="numeric" disabled={busy} onChange={(event) => setOpeningPot(event.target.value)} />
            </label>
          </div>
          {isRolloverCompletion(game) ? (
            <p className="mt-1 text-xs text-muted-ink">
              {`Includes ${formatGBP(Number.isFinite(parsedOpeningPot) ? parsedOpeningPot : 0)} rollover from Game ${game.game_number}`}
            </p>
          ) : null}
          <label className="mt-2 flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" checked={carryForward} disabled={busy} onChange={(event) => setCarryForward(event.target.checked)} />
            <span>
              Carry forward existing players
              <span className="mt-0.5 block text-xs text-muted-ink">
                New unpaid pending entries only. Old picks and eliminated status stay with Game {game.game_number}.
              </span>
            </span>
          </label>
          {confirmingStart ? (
            <div className="mt-3 rounded border border-border bg-surface p-2">
              <p className="text-xs text-ink">
                Start Game {Number.isFinite(parsedGameNumber) ? parsedGameNumber : nextGameNumber(game.game_number)} with opening pot{' '}
                {formatGBP(Number.isFinite(parsedOpeningPot) ? parsedOpeningPot : 0)}? This does not delete Game {game.game_number}.
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="los-btn-primary los-tap-target disabled:opacity-50"
                  disabled={busy || !Number.isFinite(parsedGameNumber) || parsedGameNumber < 1 || !Number.isFinite(parsedOpeningPot) || parsedOpeningPot < 0}
                  onClick={() =>
                    onStartNewGame({
                      gameNumber: parsedGameNumber,
                      openingPot: parsedOpeningPot,
                      carryForwardPlayers: carryForward,
                      season: game.season,
                    })
                  }
                >
                  {busy ? 'Starting…' : 'Start new game'}
                </button>
                <button type="button" className="los-btn-secondary los-tap-target" disabled={busy} onClick={() => setConfirmingStart(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="mt-3 los-btn-primary los-tap-target w-full sm:w-auto disabled:opacity-50" disabled={busy} onClick={() => setConfirmingStart(true)}>
              Start new game
            </button>
          )}
        </>
      ) : null}

      {showFirstRound ? (
        <>
          <h3 className="los-section-title mt-4">Open Round 1</h3>
          {firstRound.weekend ? (
            <p className="mt-1 text-xs text-muted-ink">
              Next weekend: {firstRound.weekend.sat} to {firstRound.weekend.sun} · {firstRound.weekend.eligible.length} Saturday/Sunday fixtures. Friday/Monday
              fixtures are excluded unless Admin records an exception.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-ink">{firstRound.reason ?? 'Round 1 is not ready yet.'}</p>
          )}
          <label className="mt-2 grid gap-0.5">
            <span className="los-section-title">Deadline</span>
            <input
              className="los-input"
              type="datetime-local"
              value={firstRoundDeadline}
              onChange={(event) => onFirstRoundDeadlineChange(event.target.value)}
              disabled={!firstRound.canOpen || busy}
            />
            {firstRound.weekend?.proposedDeadline ? (
              <span className="text-[0.6875rem] text-muted-ink">Proposed: {formatDeadlineLondon(firstRound.weekend.proposedDeadline)}</span>
            ) : null}
          </label>
          {confirmingFirstRound ? (
            <div className="mt-3 rounded border border-border bg-surface p-2">
              <p className="text-xs text-ink">Open Round 1 for Game {game.game_number}? This is a new-game round, not a continuation of the previous game.</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <button type="button" className="los-btn-primary los-tap-target disabled:opacity-50" disabled={!firstRound.canOpen || busy} onClick={onOpenFirstRound}>
                  {busy ? 'Opening…' : 'Confirm open Round 1'}
                </button>
                <button type="button" className="los-btn-secondary los-tap-target" disabled={busy} onClick={() => setConfirmingFirstRound(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="mt-3 los-btn-secondary los-tap-target w-full sm:w-auto disabled:opacity-50"
              disabled={!firstRound.canOpen || busy}
              onClick={() => setConfirmingFirstRound(true)}
            >
              Open Round 1
            </button>
          )}
        </>
      ) : null}

      {live ? (
        <MetricStrip className="mt-3">
          <MetricCell label="Open next round" value="Same game continues" />
          <MetricCell label="Complete game" value="Lock history" />
          <MetricCell label="Start new game" value="After completion" />
        </MetricStrip>
      ) : null}
    </section>
  )
}
