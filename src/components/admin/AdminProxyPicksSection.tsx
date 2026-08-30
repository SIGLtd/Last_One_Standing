import { useMemo, useState } from 'react'
import { buildSelectableTeamOptions } from '../../lib/fixtureOps'
import {
  LATE_PICK_REASON_EXAMPLE,
  LATE_PICK_RESOLVED_MESSAGE,
  LATE_PICK_WARNING,
  adminEntryLabel,
  canAdminSubmitLateSelection,
  getLatePickWindowMode,
  isLatePickReasonValid,
} from '../../lib/latePick'
import { operationalWindowToRoundLabel } from '../../lib/round1'
import type { Player, Selection, SelectionWindowEligibleFixture } from '../../types'

type AdminProxyPicksSectionProps = {
  players: Player[]
  fixtures: SelectionWindowEligibleFixture[]
  existingSelectionByPlayer: Map<string, Selection>
  window: { id: string; window_number: number; status: string; deadline_at: string } | null
  busy: boolean
  onCreateManualPlayer: (displayName: string, phone: string) => Promise<void>
  onSaveProxyPick: (playerId: string, teamId: string) => Promise<void>
  onSaveLatePick: (playerId: string, teamId: string, reason: string) => Promise<void>
}

export function AdminProxyPicksSection({
  players,
  fixtures,
  existingSelectionByPlayer,
  window,
  busy,
  onCreateManualPlayer,
  onSaveProxyPick,
  onSaveLatePick,
}: AdminProxyPicksSectionProps) {
  const [playerId, setPlayerId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [reason, setReason] = useState('')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const mode = getLatePickWindowMode(window)
  const teamOptions = useMemo(() => buildSelectableTeamOptions(fixtures), [fixtures])
  const selectedPlayer = players.find((player) => player.id === playerId) ?? null
  const existing = playerId ? existingSelectionByPlayer.get(playerId) : null
  const existingLabel = existing
    ? adminEntryLabel({
        adminCorrected: existing.admin_corrected,
        submittedAt: existing.updated_at ?? existing.created_at,
        deadlineAt: window?.deadline_at,
      })
    : null
  const roundLabel = window ? operationalWindowToRoundLabel(window.window_number) : 'this round'
  const lateCheck = canAdminSubmitLateSelection({
    isAdmin: true,
    windowStatus: window?.status ?? '',
    reason,
  })
  const canSaveLate = Boolean(playerId && teamId && lateCheck.allowed && isLatePickReasonValid(reason))

  async function handleCreatePlayer() {
    setMessage(null)
    await onCreateManualPlayer(newName, newPhone)
    setNewName('')
    setNewPhone('')
    setMessage('Manual player created. Select them below and save a pick.')
  }

  async function handleSave() {
    if (!playerId || !teamId) return
    setMessage(null)
    await onSaveProxyPick(playerId, teamId)
    const teamName = teamOptions.find((team) => team.team_id === teamId)?.team_name ?? teamId
    setMessage(`Pick recorded for ${selectedPlayer?.display_name ?? 'player'}: ${teamName}.`)
  }

  async function handleSaveLate() {
    if (!playerId || !teamId || !canSaveLate) return
    setMessage(null)
    await onSaveLatePick(playerId, teamId, reason.trim())
    const teamName = teamOptions.find((team) => team.team_id === teamId)?.team_name ?? teamId
    setMessage(`Late pick recorded for ${selectedPlayer?.display_name ?? 'player'}: ${teamName}.`)
    setReason('')
  }

  return (
    <section className="los-admin-section los-cockpit-card">
      <h2 className="los-section-title">
        {mode === 'late_override' ? 'Admin late pick override' : 'Enter a pick for someone else'}
      </h2>
      <p className="mt-1 text-xs text-muted-ink">
        {mode === 'late_override'
          ? `Admin only. Enter or amend a ${roundLabel} pick after the deadline. Saving updates the same player/round pick rather than creating a duplicate.`
          : 'Admin only. Use this for players who are not logging in. Saving updates the same current-round pick rather than creating a duplicate.'}
      </p>

      {mode === 'late_override' ? <div className="mt-2 los-alert los-alert-warning">{LATE_PICK_WARNING}</div> : null}

      {mode === 'resolved' ? <div className="mt-2 los-alert los-alert-warning">{LATE_PICK_RESOLVED_MESSAGE}</div> : null}

      <div className="mt-3 grid gap-2">
        <label className="grid gap-0.5">
          <span className="los-section-title">Player</span>
          <select
            className="los-input"
            value={playerId}
            onChange={(event) => setPlayerId(event.target.value)}
            disabled={busy || mode === 'resolved' || mode === 'unavailable'}
          >
            <option value="">Select player</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.display_name}
                {player.is_manual ? ' (manual)' : ''}
                {existingSelectionByPlayer.get(player.id)?.team_id ? ' · has pick' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-0.5">
          <span className="los-section-title">Round / window</span>
          <input className="los-input" value={roundLabel} readOnly disabled />
        </label>

        <label className="grid gap-0.5">
          <span className="los-section-title">Team</span>
          <select
            className="los-input"
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            disabled={busy || teamOptions.length === 0 || mode === 'resolved' || mode === 'unavailable'}
          >
            <option value="">Select team</option>
            {teamOptions.map((team) => (
              <option key={team.team_id} value={team.team_id}>
                {team.team_name} vs {team.opponent_name}
              </option>
            ))}
          </select>
        </label>

        {existing?.team_id ? (
          <p className="text-xs text-muted-ink">
            Current pick will be amended, not duplicated.
            {existingLabel ? ` · ${existingLabel}` : ''}
          </p>
        ) : null}

        {mode === 'late_override' ? (
          <label className="grid gap-0.5">
            <span className="los-section-title">Reason</span>
            <textarea
              className="los-input min-h-20"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={LATE_PICK_REASON_EXAMPLE}
              disabled={busy}
              required
            />
          </label>
        ) : null}

        {mode === 'late_override' ? (
          <button
            type="button"
            disabled={busy || !canSaveLate}
            onClick={() => void handleSaveLate()}
            className="los-btn-primary los-tap-target w-full sm:w-auto disabled:opacity-50"
          >
            {busy ? 'Saving…' : existing?.team_id ? 'Update late pick' : 'Enter late pick'}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !playerId || !teamId || mode !== 'proxy'}
            onClick={() => void handleSave()}
            className="los-btn-primary los-tap-target w-full sm:w-auto disabled:opacity-50"
          >
            {busy ? 'Saving…' : existing?.team_id ? 'Update pick' : 'Save pick'}
          </button>
        )}
      </div>

      <details className="mt-3">
        <summary className="los-tap-target cursor-pointer text-xs font-medium text-ink">Create manual player</summary>
        <div className="mt-2 grid gap-2">
          <label className="grid gap-0.5">
            <span className="los-section-title">Name</span>
            <input
              className="los-input"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              disabled={busy}
            />
          </label>
          <label className="grid gap-0.5">
            <span className="los-section-title">Phone (optional)</span>
            <input
              className="los-input"
              value={newPhone}
              onChange={(event) => setNewPhone(event.target.value)}
              disabled={busy}
            />
          </label>
          <button
            type="button"
            disabled={busy || newName.trim().length < 2}
            onClick={() => void handleCreatePlayer()}
            className="los-btn-secondary los-tap-target w-full sm:w-auto disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create offline player'}
          </button>
        </div>
      </details>

      {message ? <div className="mt-2 los-alert los-alert-success">{message}</div> : null}
    </section>
  )
}
