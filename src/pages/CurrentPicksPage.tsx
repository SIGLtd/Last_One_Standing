import { Card } from '../components/Card'
import type { Selection } from '../types'
import { TEAM_ID_TO_NAME } from '../config/teams'
import { CURRENT_GAME } from '../lib/constants'

type Row = {
  player: string
  selection: Selection
  survival_status: 'alive' | 'eliminated' | 'unknown'
}

export function CurrentPicksPage() {
  // Milestone 1: static list — visibility is always open
  const rows: Row[] = [
    {
      player: 'Alex',
      selection: {
        id: '1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        game_id: 'g27',
        window_id: 'w1',
        player_id: 'p1',
        team_id: 'ars',
        status: 'submitted',
      },
      survival_status: 'alive',
    },
    {
      player: 'Bendy',
      selection: {
        id: '2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        game_id: 'g27',
        window_id: 'w1',
        player_id: 'p2',
        team_id: null,
        status: 'no_pick',
      },
      survival_status: 'unknown',
    },
    {
      player: 'Chris',
      selection: {
        id: '3',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        game_id: 'g27',
        window_id: 'w1',
        player_id: 'p3',
        team_id: 'tot',
        status: 'submitted',
      },
      survival_status: 'alive',
    },
  ]

  return (
    <div className="grid gap-4">
      <Card title="Current picks" description={`Game ${CURRENT_GAME} • Visible to everyone at all times`}>
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs font-semibold text-muted">
                <th className="border-b border-border px-3 py-3">Player</th>
                <th className="border-b border-border px-3 py-3">Selected team</th>
                <th className="border-b border-border px-3 py-3">Pick status</th>
                <th className="border-b border-border px-3 py-3">Survival status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const teamName = row.selection.team_id ? TEAM_ID_TO_NAME.get(row.selection.team_id) : null
                return (
                  <tr key={row.selection.id} className="text-sm">
                    <td className="border-b border-border/70 px-3 py-3 font-semibold">{row.player}</td>
                    <td className="border-b border-border/70 px-3 py-3 text-text">
                      {teamName ?? <span className="text-muted">No pick yet</span>}
                    </td>
                    <td className="border-b border-border/70 px-3 py-3 text-muted">
                      {row.selection.status === 'no_pick' ? 'No pick yet' : row.selection.status}
                    </td>
                    <td className="border-b border-border/70 px-3 py-3 text-muted">{row.survival_status}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

