import { useState } from 'react'
import { TeamChip } from './TeamChip'
import { homeSurvivorPreview, shouldCollapseHomeSurvivorList, type HomeSurvivorRow } from '../lib/survivalStatus'

export function WhoSurvivedSection({
  roundLabel,
  survivors,
}: {
  roundLabel: string
  survivors: HomeSurvivorRow[]
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = homeSurvivorPreview(survivors, expanded)
  const collapsible = shouldCollapseHomeSurvivorList(survivors.length)

  return (
    <section className="los-home-panel">
      <h2 className="text-sm font-semibold text-ink">Who survived</h2>
      <p className="mt-0.5 text-sm text-muted-ink">
        {survivors.length} player{survivors.length === 1 ? '' : 's'} through from {roundLabel}
      </p>
      <ul className="mt-2 grid gap-1.5">
        {visible.map((row) => (
          <li key={row.playerId} className="flex min-w-0 items-center gap-2">
            <TeamChip teamId={row.teamId} size="sm" />
            <span className="min-w-0 truncate text-sm font-medium text-ink">{row.displayName}</span>
          </li>
        ))}
      </ul>
      {collapsible ? (
        <button type="button" className="los-home-ghost" onClick={() => setExpanded((open) => !open)}>
          {expanded ? 'Hide survivors' : 'View all survivors'}
        </button>
      ) : null}
    </section>
  )
}
