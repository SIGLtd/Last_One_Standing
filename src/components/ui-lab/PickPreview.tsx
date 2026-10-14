import { useState } from 'react'
import { TeamChip } from '../TeamChip'
import {
  UI_LAB_DEADLINE_RULE,
  UI_LAB_PREVIEW_ONLY,
  pickPreviewCanConfirm,
  pickPreviewCanSubmit,
  type PreviewPersona,
} from '../../lib/uiLabPreview'
import { getTeamIdentity } from '../../lib/teamIdentity'
import type { SelectionWindowEligibleFixture } from '../../types'

export function PickPreview({
  roundLabel,
  deadlineLabel,
  spectator,
  persona,
  onPersonaChange,
  fixtures,
  usedTeamIds,
  live = false,
  canPick = false,
  locked = false,
  pending = false,
  saving = false,
  savedMessage = null,
  error = null,
  savedTeamId = null,
  onSave,
}: {
  roundLabel: string
  deadlineLabel: string
  spectator: boolean
  persona?: PreviewPersona
  onPersonaChange?: (persona: PreviewPersona) => void
  fixtures: SelectionWindowEligibleFixture[]
  usedTeamIds: string[]
  live?: boolean
  canPick?: boolean
  locked?: boolean
  pending?: boolean
  saving?: boolean
  savedMessage?: string | null
  error?: string | null
  savedTeamId?: string | null
  onSave?: (teamId: string) => void
}) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const used = new Set(usedTeamIds)
  const selectedFixture = fixtures.find(
    (fixture) => fixture.home_team_id === selectedTeamId || fixture.away_team_id === selectedTeamId,
  )
  const selected = selectedTeamId
    ? {
        team_id: selectedTeamId,
        team_name:
          selectedFixture?.home_team_id === selectedTeamId
            ? selectedFixture.home_team_name
            : selectedFixture?.away_team_name ?? getTeamIdentity(selectedTeamId).shortName,
      }
    : null
  const canConfirm = pickPreviewCanConfirm({ spectator, selectedTeamId })
  const canSubmit = pickPreviewCanSubmit({
    spectator,
    selectedTeamId,
    operational: live,
    canPick: canPick && !locked,
  })

  return (
    <div className="grid gap-3 pb-24">
      <div className="los-card flex flex-wrap items-center justify-between gap-2 p-3">
        <div>
          <p className="text-sm font-semibold text-ink">{roundLabel} selection</p>
          <p className="text-xs text-muted-ink">Current deadline {deadlineLabel}</p>
          <p className="mt-1 text-xs text-muted-ink">{UI_LAB_DEADLINE_RULE}</p>
        </div>
        <span className={locked ? 'los-badge los-badge-muted' : 'los-badge los-badge-open'}>
          {locked ? 'Locked' : 'Live round'}
        </span>
      </div>

      {!live && persona && onPersonaChange ? (
        <div className="los-card flex flex-wrap gap-1 p-2">
          {(['live', 'eliminated', 'reinstated'] as PreviewPersona[]).map((item) => (
            <button
              key={item}
              type="button"
              className={[
                'los-tap-target rounded-md px-2.5 text-xs font-semibold capitalize',
                persona === item ? 'bg-purple text-white' : 'text-muted-ink',
              ].join(' ')}
              onClick={() => {
                setSelectedTeamId(null)
                onPersonaChange(item)
              }}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}

      {savedTeamId ? (
        <section className="los-card p-3">
          <div className="flex items-center gap-2">
            <TeamChip teamId={savedTeamId} size="md" />
            <div>
              <p className="text-sm font-semibold text-ink">Pick saved</p>
              <p className="text-xs text-muted-ink">You can change this before the deadline.</p>
            </div>
          </div>
        </section>
      ) : null}

      {usedTeamIds.length > 0 ? (
        <section className="los-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-ink">Used so far</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {usedTeamIds.map((teamId) => (
              <span key={teamId} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1">
                <TeamChip teamId={teamId} size="sm" />
                <span className="text-xs font-medium text-ink">{getTeamIdentity(teamId).shortName}</span>
                <span className="text-[10px] font-bold uppercase text-muted-ink">Used</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {pending ? (
        <section className="los-card p-4">
          <h2 className="text-sm font-semibold text-ink">Entry pending</h2>
          <p className="mt-1 text-sm text-muted-ink">You will be able to pick once your entry is confirmed.</p>
        </section>
      ) : spectator ? (
        <section className="los-card p-4" data-testid="pick-spectator">
          <h2 className="text-sm font-semibold text-ink">Spectator mode</h2>
          <p className="mt-1 text-sm text-muted-ink">
            Selections are disabled while you are eliminated. You can still follow fixtures and everyone&apos;s picks.
          </p>
        </section>
      ) : (
        <p className="px-1 text-xs text-muted-ink">No team is preselected. Tap a shirt to choose.</p>
      )}

      {error ? <div className="los-alert los-alert-error text-sm">{error}</div> : null}
      {savedMessage ? <div className="los-alert los-alert-success text-sm">{savedMessage}</div> : null}

      <div className="grid gap-2">
        {fixtures.map((fixture) => (
          <article key={fixture.id} className="los-card p-3">
            <p className="mb-2 text-xs text-muted-ink">
              {fixture.home_team_name} vs {fixture.away_team_name}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <TeamPickButton
                teamId={fixture.home_team_id}
                teamName={fixture.home_team_name}
                locked={used.has(fixture.home_team_id)}
                selected={selectedTeamId === fixture.home_team_id}
                disabled={spectator || pending || locked || used.has(fixture.home_team_id)}
                onSelect={() => setSelectedTeamId(fixture.home_team_id)}
              />
              <TeamPickButton
                teamId={fixture.away_team_id}
                teamName={fixture.away_team_name}
                locked={used.has(fixture.away_team_id)}
                selected={selectedTeamId === fixture.away_team_id}
                disabled={spectator || pending || locked || used.has(fixture.away_team_id)}
                onSelect={() => setSelectedTeamId(fixture.away_team_id)}
              />
            </div>
          </article>
        ))}
      </div>

      {fixtures.length === 0 ? <p className="text-sm text-muted-ink">No eligible fixtures loaded.</p> : null}

      <div className="sticky bottom-3 z-20 los-card grid gap-2 p-3" data-testid="pick-confirm-bar">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {selected ? <TeamChip teamId={selected.team_id} size="md" /> : null}
            <div className="min-w-0">
              <p className="text-xs text-muted-ink">{canConfirm ? 'Confirm pick' : 'Current choice'}</p>
              <p className="truncate text-sm font-semibold text-ink">{selected?.team_name ?? 'Select a team above'}</p>
            </div>
          </div>
          <button
            type="button"
            className="los-btn-primary los-tap-target shrink-0 text-sm"
            disabled={!canConfirm || !canSubmit || saving}
            onClick={() => {
              if (selectedTeamId && onSave) onSave(selectedTeamId)
            }}
          >
            {live ? (saving ? 'Saving...' : 'Save pick') : UI_LAB_PREVIEW_ONLY}
          </button>
        </div>
        {canConfirm ? (
          <p className="text-xs text-muted-ink">
            You are picking {selected?.team_name} to win. If they draw or lose, you are eliminated.
          </p>
        ) : null}
        {live && locked ? <p className="text-xs text-muted-ink">The deadline has passed. Normal picks are locked.</p> : null}
      </div>
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
        selected ? 'border-lime bg-[#531375]' : 'border-border bg-surface-2',
        locked ? 'opacity-50' : '',
      ].join(' ')}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-1">
        <TeamChip teamId={teamId} size="md" />
        {locked ? <span className="text-[10px] font-bold uppercase text-muted-ink">Used</span> : null}
      </div>
      <span className={['mt-1 text-sm font-semibold text-ink', locked ? 'line-through' : ''].join(' ')}>{teamName}</span>
    </button>
  )
}
