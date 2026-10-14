import { useState } from 'react'
import { TeamChip } from '../../TeamChip'
import {
  UI_LAB_DEADLINE_RULE,
  UI_LAB_PREVIEW_ONLY,
  type PreviewPersona,
} from '../../../lib/uiLabPreview'
import { getTeamIdentity } from '../../../lib/teamIdentity'
import type { SelectionWindowEligibleFixture } from '../../../types'
import { formatCompactKickoffLondon } from '../../../lib/fixtureOps'
import { londonKickoffClock } from './labV2Utils'

export function PickLabV2({
  roundLabel,
  deadlineLabel,
  spectator,
  persona,
  onPersonaChange,
  fixtures,
  usedTeamIds,
}: {
  roundLabel: string
  deadlineLabel: string
  spectator: boolean
  persona: PreviewPersona
  onPersonaChange: (persona: PreviewPersona) => void
  fixtures: SelectionWindowEligibleFixture[]
  usedTeamIds: string[]
}) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const used = new Set(usedTeamIds)
  const selected = fixtures.flatMap((fixture) => [
    { team_id: fixture.home_team_id, team_name: fixture.home_team_name, fixture },
    { team_id: fixture.away_team_id, team_name: fixture.away_team_name, fixture },
  ]).find((row) => row.team_id === selectedTeamId)

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between rounded-xl border border-[#3A1C54] bg-[#1B0C2A] p-2">
        <div>
          <p className="text-[13px] font-semibold text-white">{roundLabel} selection</p>
          <p className="text-[11px] text-[#cfc3d0]">Deadline: {deadlineLabel}</p>
        </div>
        <span className="lab-label rounded-full bg-[#caf300] px-2.5 py-1 text-[11px] uppercase text-[#171e00]">
          Live round
        </span>
      </div>

      <section className="relative overflow-hidden rounded-xl border border-[#621A8A] bg-gradient-to-br from-[#3B0D54] to-[#4E146B] p-3.5">
        <p className="lab-label text-[11px] uppercase tracking-wide text-[#caf300]">
          {spectator ? 'Spectator' : 'Active survivor'}
        </p>
        <p className="mt-1 text-sm text-[#f0dbfc]/90">
          Choose one team to win in {roundLabel}. If they draw or lose, you are eliminated. You cannot pick the same
          team twice in this game.
        </p>
        {usedTeamIds.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-[#3A1C54]/50 bg-[#14081F]/70 p-1.5">
            <span className="text-[11px] text-[#cfc3d0]">Used so far</span>
            {usedTeamIds.map((teamId) => (
              <span
                key={teamId}
                className="inline-flex items-center gap-1 rounded border border-[#531375] bg-[#2C1242] px-2 py-0.5"
              >
                <TeamChip teamId={teamId} size="sm" />
                <span className="text-[11px] font-semibold text-white">{getTeamIdentity(teamId).shortName}</span>
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-2 text-[11px] text-[#cfc3d0]">{UI_LAB_DEADLINE_RULE}</p>
      </section>

      <div className="flex flex-wrap gap-1">
        {(['live', 'eliminated'] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={[
              'rounded-md px-2.5 py-1 text-[11px] font-semibold',
              persona === id ? 'bg-[#3B0D54] text-white' : 'text-[#cfc3d0]',
            ].join(' ')}
            onClick={() => onPersonaChange(id)}
          >
            {id === 'live' ? 'Active survivor' : 'Spectator'}
          </button>
        ))}
      </div>

      {spectator ? (
        <div className="rounded-xl border border-[#3A1C54] bg-[#1F0E30] p-3" data-testid="pick-spectator">
          <p className="text-sm font-semibold text-white">Spectator mode</p>
          <p className="mt-1 text-sm text-[#cfc3d0]">
            Eliminated players cannot submit. You can still follow the picks.
          </p>
        </div>
      ) : null}

      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#cfc3d0]">
        Eligible fixtures · {fixtures.length}
      </p>
      <p className="text-[11px] text-[#cfc3d0]">No team is preselected.</p>

      <div className="grid gap-2">
        {fixtures.map((fixture) => (
          <article key={fixture.id} className="rounded-xl border border-[#3A1C54] bg-[#1F0E30] p-3.5">
            <p className="mb-2 text-[11px] text-[#cfc3d0]">{formatCompactKickoffLondon(fixture.kickoff_at)}</p>
            <div className="grid grid-cols-2 gap-2">
              <TeamPickButton
                teamId={fixture.home_team_id}
                teamName={fixture.home_team_name}
                locked={used.has(fixture.home_team_id)}
                selected={selectedTeamId === fixture.home_team_id}
                disabled={spectator || used.has(fixture.home_team_id)}
                onSelect={() => setSelectedTeamId(fixture.home_team_id)}
              />
              <TeamPickButton
                teamId={fixture.away_team_id}
                teamName={fixture.away_team_name}
                locked={used.has(fixture.away_team_id)}
                selected={selectedTeamId === fixture.away_team_id}
                disabled={spectator || used.has(fixture.away_team_id)}
                onSelect={() => setSelectedTeamId(fixture.away_team_id)}
              />
            </div>
          </article>
        ))}
      </div>

      {fixtures.length === 0 ? <p className="text-sm text-[#cfc3d0]">No eligible fixtures loaded.</p> : null}

      <div
        className="sticky bottom-3 z-20 flex items-center justify-between gap-2 rounded-xl border border-[#3A1C54] bg-[#1B0C2A]/95 p-2"
        data-testid="pick-confirm-bar"
      >
        <div className="flex min-w-0 items-center gap-2">
          {selected ? <TeamChip teamId={selected.team_id} size="md" /> : null}
          <div className="min-w-0">
            <p className="text-[11px] text-[#cfc3d0]">{selected ? 'Confirm pick' : 'Current choice'}</p>
            <p className="truncate text-sm font-bold text-white">{selected?.team_name ?? 'Select a team above'}</p>
          </div>
        </div>
        <button
          type="button"
          className="lab-label shrink-0 rounded-lg bg-[#caf300] px-3 py-2.5 text-[13px] text-[#171e00]"
          disabled={!selected || spectator}
          onClick={() => setConfirmOpen(true)}
        >
          Confirm
        </button>
      </div>

      {confirmOpen && selected ? (
        <div className="rounded-2xl border border-[#3A1C54] bg-[#1B0C2A] p-4">
          <p className="lab-label text-[11px] uppercase tracking-wider text-[#caf300]">Confirm {roundLabel} pick</p>
          <p className="mt-2 text-lg font-bold text-white">{selected.team_name}</p>
          <p className="mt-1 text-sm text-[#f0dbfc]/90">
            You are picking {selected.team_name} to win. If they draw or lose, you are eliminated.
          </p>
          <p className="mt-2 text-[11px] text-[#cfc3d0]">
            Kickoff {londonKickoffClock(selected.fixture.kickoff_at)}. {UI_LAB_DEADLINE_RULE}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-lg border border-[#3A1C54] bg-[#2C1242] py-2.5 text-sm font-semibold text-white"
              onClick={() => setConfirmOpen(false)}
            >
              Go back
            </button>
            <button type="button" className="rounded-lg bg-[#caf300] py-2.5 text-sm font-bold text-[#171e00]" disabled>
              {UI_LAB_PREVIEW_ONLY}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TeamPickButton({
  teamId,
  teamName,
  locked,
  selected,
  disabled,
  onSelect,
}: {
  teamId: string
  teamName: string
  locked: boolean
  selected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      data-team={teamId}
      data-locked={locked ? 'true' : 'false'}
      className={[
        'flex min-h-[76px] flex-col justify-between rounded-lg border p-2 text-left',
        selected ? 'border-[#caf300] bg-[#531375]' : 'border-[#3A1C54] bg-[#241138]',
        locked ? 'opacity-45' : '',
      ].join(' ')}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-1">
        <TeamChip teamId={teamId} size="md" />
        {locked ? <span className="lab-label text-[10px] uppercase text-[#00e2a0]">Used</span> : null}
      </div>
      <span className={['mt-1 text-sm font-semibold text-white', locked ? 'line-through' : ''].join(' ')}>
        {teamName}
      </span>
      <span className="text-[11px] text-[#cfc3d0]">{locked ? 'Already used' : 'Tap to pick'}</span>
    </button>
  )
}
