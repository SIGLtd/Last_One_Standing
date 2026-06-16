import { useMemo, useState } from 'react'
import { Card } from '../components/Card'
import { TEAMS_2026 } from '../config/teams'
import { CURRENT_GAME } from '../lib/constants'

type LockState = {
  deadlineLabel: string
  locked: boolean
}

export function PickPage() {
  // Milestone 1: static placeholder lock state and used teams.
  const lockState: LockState = {
    deadlineLabel: 'Locks 1 hour before first eligible weekend fixture (schedule TBD)',
    locked: false,
  }

  const usedTeamIds = useMemo(() => new Set<string>(['ars', 'liv', 'mci']), [])
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>('tot')

  const selectedTeam = TEAMS_2026.find((t) => t.id === selectedTeamId) ?? null

  return (
    <div className="grid gap-4">
      <Card
        title="Make your pick"
        description={`Game ${CURRENT_GAME} • Choose one team for the next eligible weekend`}
        right={
          <span
            className={[
              'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
              lockState.locked ? 'border-border bg-surface-2 text-muted' : 'border-success/30 bg-success/10 text-text',
            ].join(' ')}
          >
            {lockState.locked ? 'Locked' : 'Open'}
          </span>
        }
      >
        <div className="grid gap-3">
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="text-xs font-semibold text-muted">Deadline</div>
            <div className="mt-1 text-sm text-text">{lockState.deadlineLabel}</div>
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="text-xs font-semibold text-muted">Selected team</div>
            <div className="mt-1 text-sm text-text">{selectedTeam ? selectedTeam.name : 'No team selected'}</div>
            <div className="mt-2 text-xs text-muted">
              {lockState.locked
                ? 'Selection is read-only after lock.'
                : 'You can change your pick any time before lock.'}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {TEAMS_2026.map((team) => {
              const isUsed = usedTeamIds.has(team.id)
              const isSelected = selectedTeamId === team.id
              const disabled = lockState.locked || isUsed
              return (
                <button
                  key={team.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelectedTeamId(team.id)}
                  className={[
                    'flex items-center justify-between rounded-xl border px-3 py-3 text-sm transition-colors',
                    disabled
                      ? 'border-border/60 bg-surface/30 text-muted opacity-70'
                      : 'border-border bg-surface-2 text-text hover:bg-surface',
                    isSelected ? 'outline outline-2 outline-accent' : '',
                  ].join(' ')}
                >
                  <span className="font-semibold">{team.name}</span>
                  <span className="text-xs font-semibold text-muted">
                    {isUsed ? 'Used' : isSelected ? 'Selected' : 'Available'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </Card>
    </div>
  )
}

