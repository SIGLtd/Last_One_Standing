import { useEffect, useMemo, useState } from 'react'
import { buildSelectableTeamOptions, formatDeadlineLondon, formatLondonDateTime } from '../../lib/fixtureOps'
import { londonDateTimeLocalToUtcIso, utcIsoToLondonDateTimeLocal } from '../../lib/londonDeadline'
import {
  REINSTATE_NO_WIN_WARNING,
  REINSTATE_REASON_EXAMPLE,
  REINSTATE_RESULT_SYNC_WARNING,
  REINSTATE_SECTION_COPY,
  canAdminReinstatePlayer,
  provenWinningPickFromFixture,
} from '../../lib/playerReinstatement'
import { operationalWindowToRoundLabel } from '../../lib/round1'
import {
  ROUND_EDIT_COPY,
  ROUND_EDIT_KICKOFF_WARNING,
  ROUND_EDIT_PICKS_WARNING,
  ROUND_EDIT_REASON_EXAMPLE,
  canAdminUpdateRoundWindow,
} from '../../lib/roundWindowEdit'
import { getTeamIdentity } from '../../lib/teamIdentity'
import type {
  Game,
  GameEntryWithPlayer,
  Player,
  SeasonFixture,
  Selection,
  SelectionWindowEligibleFixture,
  SelectionWindowWithMeta,
} from '../../types'

type AdminCorrectionsSectionProps = {
  game: Game | null
  entries: GameEntryWithPlayer[]
  players: Player[]
  windows: SelectionWindowWithMeta[]
  openWindow: SelectionWindowWithMeta | null
  seasonFixtures: SeasonFixture[]
  windowFixtures: Record<string, SelectionWindowEligibleFixture[]>
  gameSelections: Selection[]
  openPickCount: number
  busy: boolean
  onNeedWindowFixtures: (windowId: string) => Promise<SelectionWindowEligibleFixture[]>
  onReinstate: (input: {
    playerId: string
    gameId: string
    windowId: string
    reason: string
    confirm: boolean
    teamId: string | null
    confirmWithoutWinningPick: boolean
  }) => Promise<void>
  onUpdateRound: (input: { windowId: string; deadlineAt: string; reason: string; confirm: boolean }) => Promise<void>
}

export function AdminCorrectionsSection({
  game,
  entries,
  players,
  windows,
  openWindow,
  seasonFixtures,
  windowFixtures,
  gameSelections,
  openPickCount,
  busy,
  onNeedWindowFixtures,
  onReinstate,
  onUpdateRound,
}: AdminCorrectionsSectionProps) {
  const operationalWindows = useMemo(
    () => windows.filter((window) => window.window_number >= 2).sort((a, b) => b.window_number - a.window_number),
    [windows],
  )
  const defaultWindowId =
    operationalWindows.find((window) => window.status === 'resolved')?.id ?? operationalWindows[0]?.id ?? ''

  const [playerId, setPlayerId] = useState('')
  const [windowId, setWindowId] = useState(defaultWindowId)
  const [teamId, setTeamId] = useState('')
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [confirmWithoutWin, setConfirmWithoutWin] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [deadlineLocal, setDeadlineLocal] = useState(openWindow ? utcIsoToLondonDateTimeLocal(openWindow.deadline_at) : '')
  const [roundReason, setRoundReason] = useState('')
  const [roundConfirmed, setRoundConfirmed] = useState(false)
  const [roundMessage, setRoundMessage] = useState<string | null>(null)

  useEffect(() => {
    if (openWindow?.deadline_at) setDeadlineLocal(utcIsoToLondonDateTimeLocal(openWindow.deadline_at))
  }, [openWindow?.id, openWindow?.deadline_at])

  const selectedWindow = operationalWindows.find((window) => window.id === windowId) ?? null
  const selectedEntry = entries.find((entry) => entry.player_id === playerId) ?? null
  const selectedPlayer = players.find((player) => player.id === playerId) ?? null
  const selectedPick = gameSelections.find((selection) => selection.player_id === playerId && selection.window_id === windowId) ?? null
  const fixtures = selectedWindow ? windowFixtures[selectedWindow.id] ?? [] : []
  const teamOptions = useMemo(() => buildSelectableTeamOptions(fixtures), [fixtures])
  const effectiveTeamId = teamId || selectedPick?.team_id || ''
  const snapshot = fixtures.find((fixture) => fixture.home_team_id === effectiveTeamId || fixture.away_team_id === effectiveTeamId)
  const liveFixture = snapshot ? seasonFixtures.find((row) => row.id === snapshot.season_fixture_id) : null
  const proven = snapshot && liveFixture
    ? provenWinningPickFromFixture({
        teamId: effectiveTeamId,
        homeTeamId: snapshot.home_team_id,
        awayTeamId: snapshot.away_team_id,
        homeScore: liveFixture.home_score,
        awayScore: liveFixture.away_score,
        status: liveFixture.status,
        resultStatus: liveFixture.result_status,
      })
    : effectiveTeamId
      ? { teamId: effectiveTeamId, fixtureFinal: false, teamWon: false, needsResultSync: true }
      : null

  const reinstateCheck = canAdminReinstatePlayer({
    isAdmin: true,
    gameStatus: game?.status ?? '',
    entryStatus: selectedEntry?.status ?? null,
    windowExists: Boolean(selectedWindow),
    reason,
    confirmed,
    provenWin: proven,
    confirmWithoutWinningPick: confirmWithoutWin,
  })

  const roundDeadlineUtc = londonDateTimeLocalToUtcIso(deadlineLocal) || openWindow?.deadline_at || ''
  const roundCheck = openWindow
    ? canAdminUpdateRoundWindow({
        isAdmin: true,
        gameStatus: game?.status ?? '',
        windowStatus: openWindow.status,
        newDeadlineAt: roundDeadlineUtc,
        currentDeadlineAt: openWindow.deadline_at,
        earliestKickoffAt: openWindow.earliest_kickoff_at ?? null,
        pickCount: openPickCount,
        reason: roundReason,
        confirmed: roundConfirmed,
      })
    : { allowed: false, error: 'NO_ACTIVE_WINDOW', warning: null }

  async function handleWindowChange(nextId: string) {
    setWindowId(nextId)
    setTeamId('')
    if (nextId && !windowFixtures[nextId]) {
      await onNeedWindowFixtures(nextId)
    }
  }

  async function handleReinstate() {
    if (!game || !playerId || !windowId || !reinstateCheck.allowed) return
    setMessage(null)
    await onReinstate({
      playerId,
      gameId: game.id,
      windowId,
      reason: reason.trim(),
      confirm: confirmed,
      teamId: effectiveTeamId || null,
      confirmWithoutWinningPick: confirmWithoutWin,
    })
    setMessage(`${selectedPlayer?.display_name ?? 'Player'} reinstated.`)
    setConfirmed(false)
    setConfirmWithoutWin(false)
  }

  async function handleUpdateRound() {
    if (!openWindow) return
    setRoundMessage(null)
    const deadlineAt = londonDateTimeLocalToUtcIso(deadlineLocal)
    const liveCheck = canAdminUpdateRoundWindow({
      isAdmin: true,
      gameStatus: game?.status ?? '',
      windowStatus: openWindow.status,
      newDeadlineAt: deadlineAt,
      currentDeadlineAt: openWindow.deadline_at,
      earliestKickoffAt: openWindow.earliest_kickoff_at ?? null,
      pickCount: openPickCount,
      reason: roundReason,
      confirmed: roundConfirmed,
    })
    if (!liveCheck.allowed) {
      setRoundMessage(liveCheck.error)
      return
    }
    await onUpdateRound({
      windowId: openWindow.id,
      deadlineAt,
      reason: roundReason.trim(),
      confirm: roundConfirmed,
    })
    setRoundMessage('Round deadline updated.')
    setRoundConfirmed(false)
  }

  const pickLabel = selectedPick?.team_id
    ? `${getTeamIdentity(selectedPick.team_id).shortName} · ${selectedPick.outcome ?? 'pending'}`
    : 'No stored pick'

  const resultLabel = liveFixture
    ? `${snapshot?.home_team_name ?? liveFixture.home_team_id} ${liveFixture.home_score ?? '-'} - ${liveFixture.away_score ?? '-'} ${snapshot?.away_team_name ?? liveFixture.away_team_id} · ${liveFixture.result_status}`
    : null

  return (
    <section className="los-admin-section los-cockpit-card">
      <h2 className="los-section-title">Corrections</h2>
      <p className="mt-1 text-xs text-muted-ink">{REINSTATE_SECTION_COPY}</p>

      <h3 className="los-section-title mt-4">Reinstate player</h3>
      <p className="mt-1 text-xs text-muted-ink">Example reason: {REINSTATE_REASON_EXAMPLE}</p>

      <div className="mt-3 grid gap-2">
        <label className="grid gap-0.5">
          <span className="los-section-title">Player</span>
          <select className="los-input" value={playerId} onChange={(event) => setPlayerId(event.target.value)} disabled={busy}>
            <option value="">Select player</option>
            {entries
              .slice()
              .sort((a, b) => {
                if (a.status === 'eliminated' && b.status !== 'eliminated') return -1
                if (b.status === 'eliminated' && a.status !== 'eliminated') return 1
                return (a.player?.display_name ?? '').localeCompare(b.player?.display_name ?? '')
              })
              .map((entry) => (
                <option key={entry.id} value={entry.player_id}>
                  {entry.player?.display_name ?? 'Player'} · {entry.status}
                </option>
              ))}
          </select>
        </label>

        <p className="text-xs text-muted-ink">Game {game?.game_number ?? ''} · {game?.status ?? 'unknown'}</p>

        <label className="grid gap-0.5">
          <span className="los-section-title">Round</span>
          <select
            className="los-input"
            value={windowId}
            onChange={(event) => void handleWindowChange(event.target.value)}
            disabled={busy}
          >
            <option value="">Select round</option>
            {operationalWindows.map((window) => (
              <option key={window.id} value={window.id}>
                {operationalWindowToRoundLabel(window.window_number)} · {window.status}
              </option>
            ))}
          </select>
        </label>

        <p className="text-xs text-muted-ink">Stored pick: {pickLabel}</p>
        {resultLabel ? <p className="text-xs text-muted-ink">Stored result: {resultLabel}</p> : null}
        {proven?.teamWon ? <p className="text-xs text-muted-ink">Stored result confirms a win.</p> : null}

        <label className="grid gap-0.5">
          <span className="los-section-title">Winning team if missing</span>
          <select className="los-input" value={teamId} onChange={(event) => setTeamId(event.target.value)} disabled={busy}>
            <option value="">Use stored pick</option>
            {teamOptions.map((team) => (
              <option key={team.team_id} value={team.team_id}>
                {team.team_name}
              </option>
            ))}
          </select>
        </label>

        {proven?.needsResultSync ? <div className="los-alert los-alert-warning">{REINSTATE_RESULT_SYNC_WARNING}</div> : null}
        {!proven?.teamWon ? <div className="los-alert los-alert-warning">{REINSTATE_NO_WIN_WARNING}</div> : null}

        <label className="grid gap-0.5">
          <span className="los-section-title">Reason</span>
          <textarea className="los-input" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} />
        </label>

        <label className="flex items-center gap-2 text-xs text-ink">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={busy} />
          Confirm this organiser-approved correction
        </label>

        {!proven?.teamWon ? (
          <label className="flex items-center gap-2 text-xs text-ink">
            <input type="checkbox" checked={confirmWithoutWin} onChange={(event) => setConfirmWithoutWin(event.target.checked)} disabled={busy} />
            Confirm reinstatement without a proven winning pick
          </label>
        ) : null}

        <button
          type="button"
          className="los-btn-primary los-tap-target w-full sm:w-auto disabled:opacity-50"
          disabled={busy || !reinstateCheck.allowed}
          onClick={() => void handleReinstate()}
        >
          Reinstate player
        </button>
        {message ? <p className="text-xs text-muted-ink">{message}</p> : null}
        {reinstateCheck.error && confirmed ? <p className="text-xs text-muted-ink">{reinstateCheck.error}</p> : null}
      </div>

      <h3 className="los-section-title mt-6">Edit current round</h3>
      <p className="mt-1 text-xs text-muted-ink">{ROUND_EDIT_COPY}</p>
      {openWindow ? (
        <div className="mt-3 grid gap-2">
          <p className="text-xs text-muted-ink">
            {operationalWindowToRoundLabel(openWindow.window_number)} · {openWindow.status} · current deadline{' '}
            {formatDeadlineLondon(openWindow.deadline_at)}
          </p>
          {openWindow.earliest_kickoff_at ? (
            <p className="text-xs text-muted-ink">First kick-off: {formatLondonDateTime(openWindow.earliest_kickoff_at)}</p>
          ) : null}
          {openPickCount > 0 ? <div className="los-alert los-alert-warning">{ROUND_EDIT_PICKS_WARNING}</div> : null}

          <label className="grid gap-0.5">
            <span className="los-section-title">Deadline</span>
            <input
              className="los-input"
              type="datetime-local"
              value={deadlineLocal}
              onChange={(event) => setDeadlineLocal(event.target.value)}
              disabled={busy}
            />
          </label>

          <label className="grid gap-0.5">
            <span className="los-section-title">Reason</span>
            <textarea
              className="los-input"
              rows={2}
              value={roundReason}
              onChange={(event) => setRoundReason(event.target.value)}
              placeholder={ROUND_EDIT_REASON_EXAMPLE}
              disabled={busy}
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-ink">
            <input type="checkbox" checked={roundConfirmed} onChange={(event) => setRoundConfirmed(event.target.checked)} disabled={busy} />
            Confirm this deadline correction
          </label>

          {roundCheck.warning === ROUND_EDIT_KICKOFF_WARNING ? (
            <div className="los-alert los-alert-warning">{ROUND_EDIT_KICKOFF_WARNING}</div>
          ) : null}

          <button
            type="button"
            className="los-btn-primary los-tap-target w-full sm:w-auto disabled:opacity-50"
            disabled={busy || !roundCheck.allowed}
            onClick={() => void handleUpdateRound()}
          >
            Save round details
          </button>
          {roundMessage ? <p className="text-xs text-muted-ink">{roundMessage}</p> : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-ink">No open round is available to edit.</p>
      )}
    </section>
  )
}
