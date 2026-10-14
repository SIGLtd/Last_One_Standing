import { TeamChip } from '../../TeamChip'
import { formatGBP } from '../../../lib/constants'
import { UI_LAB_DEADLINE_RULE, type PlayerHomePreviewModel, type PreviewPersona } from '../../../lib/uiLabPreview'
import type { PickDistributionRow } from '../../../lib/pickDistribution'
import type { HomeSurvivorRow } from '../../../lib/survivalStatus'
import { getTeamIdentity } from '../../../lib/teamIdentity'
import type { SelectionWindowEligibleFixture } from '../../../types'
import { CONSENSUS_BAR_COLOURS, groupFixturesByLondonDay, londonKickoffClock } from './labV2Utils'

const PERSONAS: Array<{ id: PreviewPersona; label: string }> = [
  { id: 'live', label: 'Active survivor' },
  { id: 'eliminated', label: 'Spectator' },
  { id: 'reinstated', label: 'Reinstated' },
  { id: 'complete', label: 'Game complete' },
]

export function PlayerHomeLabV2({
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
  onGoPick,
  onGoPicks,
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
  onGoPick: () => void
  onGoPicks: () => void
}) {
  const aliveShare = paidCount > 0 ? Math.round((survivorCount / paidCount) * 1000) / 10 : 0
  const visibleDistribution = distribution.slice(0, 3)
  const fixtureGroups = groupFixturesByLondonDay(fixtures).slice(0, 2)
  const visibleFixtures = fixtureGroups.flatMap((group) => group.fixtures)
  const extraFixtureCount = Math.max(fixtures.length - visibleFixtures.length, 0)
  const topTeamId = distribution[0]?.teamId
  const potParts = formatGBP(pot).split('.')
  const active = !model.spectator && model.statusKind !== 'complete' && model.statusKind !== 'pending'

  return (
    <div className="grid gap-3">
      <div className="lab-card flex items-center justify-between rounded-xl p-1.5">
        <span className="lab-label px-2 text-[11px] uppercase text-[#cfc3d0]">View mode</span>
        <div className="lab-well flex flex-wrap gap-1 rounded-lg p-0.5">
          {PERSONAS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={[
                'rounded-md px-2.5 py-1 text-[11px] font-semibold',
                persona === item.id ? 'bg-[#4E146B] text-white shadow-sm' : 'text-[#cfc3d0]',
              ].join(' ')}
              onClick={() => onPersonaChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section
        className="lab-hero relative overflow-hidden rounded-xl p-3.5"
        data-testid="player-context-anchor-v2"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-gradient-to-br from-[#e7b3ff]/20 via-[#00e5a3]/10 to-transparent blur-xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <span className="lab-label text-[11px] uppercase tracking-wider text-[#e7b3ff]">
              {model.gameLabel} · {model.roundLabel}
            </span>
            <span
              className={[
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                active ? 'bg-[#caf300] text-[#14081F]' : 'border border-[#e7b3ff]/20 bg-[#1C0C2D]/80 text-[#cfc3d0]',
              ].join(' ')}
            >
              <span className={['h-1.5 w-1.5 rounded-full', active ? 'bg-[#14081F]' : 'bg-[#ff7886]'].join(' ')} />
              {model.statusLabel}
            </span>
          </div>
          <h2 className="mt-2 text-[22px] font-extrabold leading-tight tracking-tight text-white">{model.headline}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[#f0dbfc]/80">{model.subtext}</p>
          {model.ticker ? <p className="mt-1 text-sm font-semibold text-white">{model.ticker}</p> : null}
          {model.currentPickTeamId ? (
            <div className="lab-well mt-3 flex items-center gap-2 rounded-lg p-2">
              <TeamChip teamId={model.currentPickTeamId} size="lg" />
              <div>
                <p className="lab-label text-[10px] uppercase text-[#cfc3d0]">Your pick</p>
                <p className="font-semibold text-white">{getTeamIdentity(model.currentPickTeamId).shortName}</p>
              </div>
            </div>
          ) : null}
          {model.usedTeamIds.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-[#cfc3d0]">Used so far</span>
              {model.usedTeamIds.map((teamId) => (
                <span
                  key={teamId}
                  className="lab-chip inline-flex items-center gap-1 rounded px-2 py-0.5"
                >
                  <TeamChip teamId={teamId} size="sm" />
                  <span className="text-[11px] font-semibold text-white">{getTeamIdentity(teamId).shortName}</span>
                </span>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className={[
              'lab-label mt-3 flex h-11 w-full items-center justify-center rounded-lg text-[13px] font-bold',
              active ? 'bg-[#d4ff00] text-[#14081F]' : 'border border-[#5d2182] bg-[#200E32] text-white',
            ].join(' ')}
            onClick={model.spectator ? onGoPicks : onGoPick}
          >
            {model.nextAction}
          </button>
          <p className="mt-2 text-[11px] text-[#cfc3d0]">{UI_LAB_DEADLINE_RULE}</p>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <section className="lab-tint-gold relative overflow-hidden rounded-xl p-3.5">
          <p className="lab-label lab-section-gold text-[11px] uppercase tracking-wider">Total prize</p>
          <p className="mt-2 text-[26px] font-extrabold leading-none text-[#ffc107]">
            {potParts[0]}
            {potParts[1] ? <span className="text-[14px] font-semibold text-[#cfc3d0]">.{potParts[1]}</span> : null}
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[#cfc3d0]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ffc107]" />
            Winner takes all
          </p>
        </section>
        <section className="lab-tint-teal rounded-xl p-3.5">
          <p className="lab-label lab-section-teal text-[11px] uppercase tracking-wider">Field count</p>
          <p className="mt-2 text-[26px] font-extrabold leading-none text-white">
            {survivorCount} <span className="text-[16px] font-normal text-[#cfc3d0]">/ {paidCount || survivorCount}</span>
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[#cfc3d0]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00e5a3]" />
            {aliveShare}% still in
          </p>
        </section>
      </div>

      <section className="lab-card space-y-3 rounded-xl p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="lab-section-teal text-[13px] font-bold">Community consensus</h3>
            <p className="text-[12px] text-[#cfc3d0]">
              {model.roundLabel} distribution across remaining {survivorCount} entries
            </p>
          </div>
          <span className="lab-chip rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-[#e7b3ff]">
            {submittedCount} picks in
          </span>
        </div>
        {visibleDistribution.length === 0 ? (
          <p className="text-sm text-[#cfc3d0]">No picks yet.</p>
        ) : (
          visibleDistribution.map((row, index) => (
            <div key={row.teamId} className="lab-row space-y-2 rounded-lg p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TeamChip teamId={row.teamId} size="sm" />
                  <span className="text-[13px] font-semibold text-white">{row.teamName}</span>
                </div>
                <span className="text-sm font-bold text-white">
                  {row.percent}% <span className="text-xs font-normal text-[#cfc3d0]">({row.count})</span>
                </span>
              </div>
              <div className="lab-well h-2 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${row.percent}%`,
                    background: CONSENSUS_BAR_COLOURS[index % CONSENSUS_BAR_COLOURS.length],
                  }}
                />
              </div>
            </div>
          ))
        )}
        <button type="button" className="lab-label text-[11px] font-bold text-[#caf300]" onClick={onGoPicks}>
          Full pool chart
        </button>
      </section>

      {survivors.length > 0 && survivorRoundLabel ? (
        <section className="lab-card rounded-xl p-3.5">
          <h3 className="lab-section-lime text-[13px] font-bold">{survivorRoundLabel} audit summary</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="lab-tint-teal rounded-lg p-2.5">
              <p className="text-sm font-bold text-white">{survivors.length} survived</p>
              <p className="text-[11px] text-[#cfc3d0]">Through to the next round</p>
            </div>
            <div className="lab-tint-lavender rounded-lg p-2.5">
              <p className="text-sm font-bold text-[#e7b3ff]">Who survived</p>
              <p className="text-[11px] text-[#cfc3d0]">Shirts and names only</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {survivors.slice(0, 6).map((row) => (
              <span
                key={row.playerId}
                className="lab-chip inline-flex items-center gap-1.5 rounded-md px-2 py-1"
              >
                <TeamChip teamId={row.teamId} size="sm" />
                <span className="text-[11px] font-medium text-white">{row.displayName}</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="lab-card space-y-3 rounded-xl p-3.5">
        <div>
          <h3 className="lab-section-lavender text-[13px] font-bold">Eligible fixtures</h3>
          <p className="text-[12px] text-[#cfc3d0]">Saturday and Sunday only · UK times</p>
        </div>
        {fixtureGroups.map((group) => (
          <div key={group.heading} className="space-y-1.5">
            <p className="lab-label text-[10px] uppercase tracking-wider text-[#e7b3ff]">{group.heading}</p>
            {group.fixtures.map((fixture) => {
              const popular =
                topTeamId === fixture.home_team_id || topTeamId === fixture.away_team_id
              return (
                <div
                  key={fixture.id}
                  className="lab-row relative overflow-hidden rounded-lg p-2.5"
                >
                  {popular ? <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#00e5a3]" /> : null}
                  <div className="flex items-center justify-between gap-2 pl-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="lab-well rounded px-1.5 py-0.5 font-mono text-[11px] text-[#ffc107]">
                        {londonKickoffClock(fixture.kickoff_at)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-white">
                          {fixture.home_team_name} vs {fixture.away_team_name}
                        </p>
                        {popular ? (
                          <span className="lab-label text-[9px] font-extrabold text-[#00e5a3]">Most picked</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <TeamChip teamId={fixture.home_team_id} size="sm" />
                      <TeamChip teamId={fixture.away_team_id} size="sm" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        {extraFixtureCount > 0 ? (
          <p className="text-center text-[12px] text-[#cfc3d0]">
            {extraFixtureCount} more weekend {extraFixtureCount === 1 ? 'fixture' : 'fixtures'}
          </p>
        ) : null}
        {fixtures.length === 0 ? <p className="text-sm text-[#cfc3d0]">No eligible fixtures loaded.</p> : null}
      </section>

      <p className="lab-well rounded-xl p-2.5 text-[11.5px] leading-relaxed text-[#cfc3d0]">
        Once a team is chosen, it cannot be used again in this game. {UI_LAB_DEADLINE_RULE}
      </p>
    </div>
  )
}
