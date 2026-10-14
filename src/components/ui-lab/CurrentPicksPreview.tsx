import { useState } from 'react'
import { Badge } from '../Badge'
import { TeamChip } from '../TeamChip'
import { formatPickCount } from '../../lib/pickDistribution'
import { getPickStatusLabel } from '../../lib/selections'
import { groupPicksByTeam } from '../../lib/uiLabPreview'
import type { SelectionWindow, WindowPickRow } from '../../types'

type PicksView = 'player' | 'team'

export function CurrentPicksPreview({
  roundLabel,
  window,
  rows,
}: {
  roundLabel: string
  window: SelectionWindow | null
  rows: WindowPickRow[]
}) {
  const [view, setView] = useState<PicksView>('player')
  const groups = groupPicksByTeam(rows)
  const submitted = rows.filter((row) => Boolean(row.team_id)).length

  return (
    <div className="grid gap-3">
      <section className="los-card p-4">
        <h2 className="text-sm font-semibold text-ink">Everyone&apos;s picks</h2>
        <p className="mt-0.5 text-xs text-muted-ink">
          {roundLabel} · {submitted} submitted · display names only
        </p>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
          <button
            type="button"
            className={['los-tap-target rounded-md text-xs font-semibold', view === 'player' ? 'bg-purple text-white' : 'text-muted-ink'].join(' ')}
            onClick={() => setView('player')}
          >
            By player
          </button>
          <button
            type="button"
            className={['los-tap-target rounded-md text-xs font-semibold', view === 'team' ? 'bg-purple text-white' : 'text-muted-ink'].join(' ')}
            onClick={() => setView('team')}
          >
            By team
          </button>
        </div>
      </section>

      {view === 'player' ? (
        <ul className="grid gap-2" data-testid="picks-by-player">
          {rows.map((row) => (
            <li key={row.player_id} className="los-card flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{row.display_name}</p>
                <p className="text-xs text-muted-ink">{getPickStatusLabel(row, window)}</p>
              </div>
              {row.team_id ? (
                <TeamChip teamId={row.team_id} size="md" />
              ) : (
                <Badge variant="warning">No pick</Badge>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid gap-2" data-testid="picks-by-team">
          {groups.map((group) => (
            <li key={group.teamId} className="los-card p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <TeamChip teamId={group.teamId} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{group.teamName}</p>
                    <p className="text-xs text-muted-ink">{group.playerNames.join(', ')}</p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-ink">{formatPickCount(group.count)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rows.length === 0 ? <p className="text-sm text-muted-ink">No picks submitted yet.</p> : null}
    </div>
  )
}
