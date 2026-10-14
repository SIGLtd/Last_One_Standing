import { FixtureMatchRow } from '../FixtureMatchRow'
import { PickDistributionRowView } from '../PickDistributionRowView'
import { TeamChip } from '../TeamChip'
import { WhoSurvivedSection } from '../WhoSurvivedSection'
import { formatGBP } from '../../lib/constants'
import {
  UI_LAB_DEADLINE_RULE,
  type PlayerHomePreviewModel,
  type PreviewPersona,
} from '../../lib/uiLabPreview'
import type { PickDistributionRow } from '../../lib/pickDistribution'
import type { HomeSurvivorRow } from '../../lib/survivalStatus'
import { getTeamIdentity } from '../../lib/teamIdentity'
import type { SelectionWindowEligibleFixture } from '../../types'

const PERSONAS: Array<{ id: PreviewPersona; label: string }> = [
  { id: 'live', label: 'Live' },
  { id: 'eliminated', label: 'Eliminated' },
  { id: 'reinstated', label: 'Reinstated' },
  { id: 'complete', label: 'Game complete' },
]

export function PlayerHomePreview({
  model,
  persona,
  onPersonaChange,
  pot,
  survivorCount,
  paidCount,
  submittedCount,
  distribution,
  fixtures,
  survivors,
  survivorRoundLabel,
}: {
  model: PlayerHomePreviewModel
  persona: PreviewPersona
  onPersonaChange: (persona: PreviewPersona) => void
  pot: number
  survivorCount: number
  paidCount: number
  submittedCount: number
  distribution: PickDistributionRow[]
  fixtures: SelectionWindowEligibleFixture[]
  survivors: HomeSurvivorRow[]
  survivorRoundLabel: string | null
}) {
  return (
    <div className="grid gap-3">
      <div className="los-card flex flex-wrap items-center justify-between gap-2 p-2">
        <span className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-ink">View mode</span>
        <div className="flex flex-wrap gap-1">
          {PERSONAS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={[
                'los-tap-target rounded-md px-2.5 text-xs font-semibold',
                persona === item.id ? 'bg-purple text-white' : 'text-muted-ink',
              ].join(' ')}
              onClick={() => onPersonaChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section className="los-card p-4" data-testid="player-context-anchor">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-ink">
            {model.gameLabel} · {model.roundLabel}
          </p>
          <span className="los-badge los-badge-muted">{model.statusLabel}</span>
        </div>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-ink">{model.headline}</h2>
        <p className="mt-1 text-sm text-muted-ink">{model.subtext}</p>
        <p className="mt-2 text-sm text-ink">
          {model.pickStatus}
          <span className="mx-1 text-muted-ink" aria-hidden="true">
            ·
          </span>
          Deadline {model.deadlineLabel}
        </p>
        <p className="mt-1 text-xs text-muted-ink">{UI_LAB_DEADLINE_RULE}</p>
        {model.usedTeamIds.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-ink">Used teams</span>
            {model.usedTeamIds.map((teamId) => (
              <span key={teamId} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1">
                <TeamChip teamId={teamId} size="sm" />
                <span className="text-xs font-medium text-ink">{getTeamIdentity(teamId).shortName}</span>
              </span>
            ))}
          </div>
        ) : null}
        <button type="button" className="los-btn-primary los-tap-target mt-3 w-full text-sm" disabled>
          {model.nextAction}
        </button>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <section className="los-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-ink">Pot</p>
          <p className="mt-1 text-xl font-bold text-ink">{formatGBP(pot)}</p>
          <p className="mt-1 text-xs text-muted-ink">Winner takes all</p>
        </section>
        <section className="los-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-ink">Still in</p>
          <p className="mt-1 text-xl font-bold text-ink">
            {survivorCount}
            <span className="text-sm font-medium text-muted-ink"> / {paidCount || survivorCount}</span>
          </p>
          <p className="mt-1 text-xs text-muted-ink">{submittedCount} picks in</p>
        </section>
      </div>

      <section className="los-card p-4">
        <h3 className="text-sm font-semibold text-ink">Most picked</h3>
        <p className="mt-0.5 text-xs text-muted-ink">Community consensus for {model.roundLabel}</p>
        {distribution.length === 0 ? (
          <p className="mt-2 text-sm text-muted-ink">No picks yet.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {distribution.slice(0, 5).map((row) => (
              <PickDistributionRowView key={row.teamId} row={row} compact />
            ))}
          </ul>
        )}
      </section>

      {survivors.length > 0 && survivorRoundLabel ? (
        <WhoSurvivedSection roundLabel={survivorRoundLabel} survivors={survivors} />
      ) : null}

      <section className="los-card p-4">
        <h3 className="text-sm font-semibold text-ink">Eligible fixtures</h3>
        <p className="mt-0.5 text-xs text-muted-ink">Saturday and Sunday only · UK times</p>
        {fixtures.length === 0 ? (
          <p className="mt-2 text-sm text-muted-ink">No eligible fixtures loaded.</p>
        ) : (
          <ul className="mt-2 grid gap-1.5">
            {fixtures.map((fixture) => (
              <FixtureMatchRow key={fixture.id} fixture={fixture} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
