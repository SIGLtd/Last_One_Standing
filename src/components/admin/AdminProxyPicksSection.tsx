import { useMemo, useState } from 'react'
import { buildSelectableTeamOptions } from '../../lib/fixtureOps'
import type { Player, Selection, SelectionWindowEligibleFixture } from '../../types'

type AdminProxyPicksSectionProps = {
  players: Player[]
  fixtures: SelectionWindowEligibleFixture[]
  existingSelectionByPlayer: Map<string, Selection>
  busy: boolean
  onCreateManualPlayer: (displayName: string, phone: string) => Promise<void>
  onSaveProxyPick: (playerId: string, teamId: string) => Promise<void>
}

export function AdminProxyPicksSection({
  players,
  fixtures,
  existingSelectionByPlayer,
  busy,
  onCreateManualPlayer,
  onSaveProxyPick,
}: AdminProxyPicksSectionProps) {
  const [playerId, setPlayerId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const teamOptions = useMemo(() => buildSelectableTeamOptions(fixtures), [fixtures])
  const selectedPlayer = players.find((player) => player.id === playerId) ?? null
  const existing = playerId ? existingSelectionByPlayer.get(playerId) : null

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

  return (
    <section className="los-admin-section los-cockpit-card">
      <h2 className="los-section-title">Enter a pick for someone else</h2>
      <p className="mt-1 text-xs text-muted-ink">
        Admin only. Use this for players who are not logging in. Saving updates the same current-round pick rather
        than creating a duplicate.
      </p>

      <div className="mt-3 grid gap-2">
        <label className="grid gap-0.5">
          <span className="los-section-title">Player</span>
          <select
            className="los-input"
            value={playerId}
            onChange={(event) => setPlayerId(event.target.value)}
            disabled={busy}
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
          <span className="los-section-title">Team</span>
          <select
            className="los-input"
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            disabled={busy || teamOptions.length === 0}
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
          <p className="text-xs text-muted-ink">Current pick will be amended, not duplicated.</p>
        ) : null}

        <button
          type="button"
          disabled={busy || !playerId || !teamId}
          onClick={() => void handleSave()}
          className="los-btn-primary los-tap-target w-full sm:w-auto disabled:opacity-50"
        >
          {busy ? 'Saving…' : existing?.team_id ? 'Update pick' : 'Save pick'}
        </button>
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
