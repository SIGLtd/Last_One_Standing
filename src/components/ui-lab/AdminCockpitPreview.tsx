import { useState } from 'react'
import { Badge } from '../Badge'
import { TeamChip } from '../TeamChip'
import { REINSTATE_REASON_EXAMPLE } from '../../lib/playerReinstatement'
import { ROUND_EDIT_REASON_EXAMPLE } from '../../lib/roundWindowEdit'
import {
  ADMIN_PREVIEW_SECTION_LABELS,
  ADMIN_PREVIEW_SECTIONS,
  REINSTATE_PREVIEW_COPY,
  ROUND_EDIT_PREVIEW_COPY,
  UI_LAB_DEADLINE_RULE,
  UI_LAB_PREVIEW_ONLY,
  roundProgressionSteps,
  settlementGateState,
  type AdminOverviewModel,
  type AdminPreviewSection,
} from '../../lib/uiLabPreview'
import { getTeamIdentity } from '../../lib/teamIdentity'

export function AdminCockpitPreview({
  overview,
  windowStatus,
  gameStatus,
  survivorCount,
}: {
  overview: AdminOverviewModel
  windowStatus: string | null
  gameStatus: string | null
  survivorCount: number
}) {
  const [section, setSection] = useState<AdminPreviewSection>('overview')
  const [gateOpen, setGateOpen] = useState(false)
  const gate = settlementGateState({ gameStatus, survivorCount })
  const steps = roundProgressionSteps({
    windowStatus,
    deadlineLabel: `${overview.deadlineLabel}. ${UI_LAB_DEADLINE_RULE}`,
  })

  return (
    <div className="grid gap-3">
      <section className="los-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-ink">Live round control</p>
        <h2 className="mt-1 text-lg font-semibold text-ink">Admin Cockpit</h2>
        <p className="mt-1 text-sm text-muted-ink">
          Segmented preview only. Live corrections stay on Admin.
        </p>
      </section>

      <nav className="los-card grid grid-cols-3 gap-1 p-1" aria-label="Admin preview sections">
        {ADMIN_PREVIEW_SECTIONS.map((item) => (
          <button
            key={item}
            type="button"
            className={[
              'los-tap-target rounded-lg px-1 py-2 text-[11px] font-semibold',
              section === item ? 'bg-purple text-white' : 'text-muted-ink',
            ].join(' ')}
            onClick={() => setSection(item)}
          >
            {ADMIN_PREVIEW_SECTION_LABELS[item]}
          </button>
        ))}
      </nav>

      {section === 'overview' ? (
        <OverviewSection overview={overview} />
      ) : null}
      {section === 'scores' ? (
        <Placeholder title="Scores" body="Result sync stays on the live Admin page." />
      ) : null}
      {section === 'picks' ? (
        <Placeholder
          title="Picks"
          body={`${overview.picksSubmitted} picks submitted among ${overview.survivorCount} survivors. Audit tools stay on live Admin.`}
        />
      ) : null}
      {section === 'corrections' ? <CorrectionsPreview overview={overview} /> : null}
      {section === 'lifecycle' ? (
        <LifecycleSection
          overview={overview}
          steps={steps}
          gate={gate}
          gateOpen={gateOpen}
          onToggleGate={() => setGateOpen((open) => !open)}
        />
      ) : null}
      {section === 'comms' ? (
        <Placeholder title="Comms" body="WhatsApp reminders stay on the live Admin page." />
      ) : null}
    </div>
  )
}

function OverviewSection({ overview }: { overview: AdminOverviewModel }) {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Metric tile="Survivors" value={String(overview.survivorCount)} />
        <Metric tile="Pot" value={overview.potLabel} />
        <Metric tile="Picks in" value={String(overview.picksSubmitted)} />
      </div>
      <section className="los-card p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">
              {overview.gameLabel} · {overview.roundLabel}
            </p>
            <p className="mt-1 text-sm text-muted-ink">Deadline {overview.deadlineLabel}</p>
            <p className="mt-1 text-xs text-muted-ink">{overview.deadlineRule}</p>
          </div>
          <Badge variant="open">Next action</Badge>
        </div>
        <p className="mt-3 text-sm font-semibold text-ink">{overview.nextAction}</p>
      </section>
      {overview.warnings.map((warning) => (
        <div key={warning} className="los-alert los-alert-warning text-sm">
          {warning}
        </div>
      ))}
    </div>
  )
}

function LifecycleSection({
  overview,
  steps,
  gate,
  gateOpen,
  onToggleGate,
}: {
  overview: AdminOverviewModel
  steps: ReturnType<typeof roundProgressionSteps>
  gate: ReturnType<typeof settlementGateState>
  gateOpen: boolean
  onToggleGate: () => void
}) {
  return (
    <div className="grid gap-3">
      <section className="los-card p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">Round progression gate</h3>
        <p className="mt-1 text-xs text-muted-ink">{overview.deadlineRule}</p>
        <ol className="mt-3 grid gap-2">
          {steps.map((step) => (
            <li key={step.title} className="rounded-lg bg-surface-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{step.title}</span>
                <span className="text-[10px] font-bold uppercase text-muted-ink">{step.state}</span>
              </div>
              <p className="mt-1 text-xs text-muted-ink">{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="los-card p-4" data-testid="settlement-gate">
        <h3 className="text-sm font-semibold text-ink">Game settlement gate</h3>
        <p className="mt-1 text-sm text-muted-ink">{gate.reason}</p>
        <button
          type="button"
          className="los-btn-secondary los-tap-target mt-3 w-full text-sm"
          onClick={onToggleGate}
        >
          {gate.label}
        </button>
        {gateOpen ? (
          <div className={['mt-3 grid grid-cols-2 gap-2', gate.unlocked ? '' : 'opacity-50'].join(' ')}>
            <div className="rounded-lg bg-surface-2 p-3">
              <p className="text-sm font-semibold text-ink">Winner paid</p>
              <p className="mt-1 text-xs text-muted-ink">Disburse {overview.potLabel}</p>
              <button type="button" className="los-btn-secondary mt-2 w-full text-xs" disabled>
                {UI_LAB_PREVIEW_ONLY}
              </button>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <p className="text-sm font-semibold text-ink">Rollover pot</p>
              <p className="mt-1 text-xs text-muted-ink">Carry into the next game</p>
              <button type="button" className="los-btn-secondary mt-2 w-full text-xs" disabled>
                {UI_LAB_PREVIEW_ONLY}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function CorrectionsPreview({ overview }: { overview: AdminOverviewModel }) {
  const brighton = getTeamIdentity('bha')

  return (
    <div className="grid gap-3">
      <article className="los-card p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Reinstate player</h3>
          <Badge variant="warning">Admin only · audited</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-ink">{REINSTATE_PREVIEW_COPY}</p>
        <p className="mt-2 text-xs text-muted-ink">
          Do not create duplicate picks. Do not use this casually. Existing used teams stay used.
        </p>
        <label className="mt-3 grid gap-1 text-xs font-semibold text-ink">
          Player
          <select className="los-input" disabled defaultValue="ben">
            <option value="ben">Ben Stephens</option>
          </select>
        </label>
        <p className="mt-2 text-xs text-muted-ink">
          Game: {overview.gameLabel} · Round: {overview.roundLabel}
        </p>
        <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-surface-2 px-2 py-1">
          <TeamChip teamId="bha" size="sm" />
          <span className="text-xs text-ink">{brighton.shortName} already used if that pick counted</span>
        </div>
        <label className="mt-3 grid gap-1 text-xs font-semibold text-ink">
          Reason
          <textarea className="los-input min-h-20" disabled defaultValue={REINSTATE_REASON_EXAMPLE} />
        </label>
        <button type="button" className="los-btn-primary los-tap-target mt-3 w-full text-sm" disabled>
          {UI_LAB_PREVIEW_ONLY}
        </button>
      </article>

      <article className="los-card p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Edit current round</h3>
          <Badge variant="warning">Admin only · audited</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-ink">{ROUND_EDIT_PREVIEW_COPY}</p>
        <p className="mt-2 text-xs text-muted-ink">
          Existing picks remain intact. Fixture snapshot is not changed. Resolved rounds cannot be edited here.
        </p>
        <p className="mt-2 text-sm text-ink">Current round: {overview.roundLabel}</p>
        <p className="text-sm text-ink">Current deadline: {overview.deadlineLabel}</p>
        <p className="mt-1 text-xs text-muted-ink">{UI_LAB_DEADLINE_RULE}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs font-semibold text-ink">
            New date
            <input className="los-input" type="date" disabled />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-ink">
            New time
            <input className="los-input" type="time" disabled defaultValue="16:00" />
          </label>
        </div>
        <label className="mt-3 grid gap-1 text-xs font-semibold text-ink">
          Reason
          <textarea className="los-input min-h-20" disabled defaultValue={ROUND_EDIT_REASON_EXAMPLE} />
        </label>
        <button type="button" className="los-btn-primary los-tap-target mt-3 w-full text-sm" disabled>
          {UI_LAB_PREVIEW_ONLY}
        </button>
      </article>
    </div>
  )
}

function Metric({ tile, value }: { tile: string; value: string }) {
  return (
    <div className="los-card p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-ink">{tile}</p>
      <p className="mt-1 text-lg font-bold text-ink">{value}</p>
    </div>
  )
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <section className="los-card p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-muted-ink">{body}</p>
      <p className="mt-2 text-xs font-semibold uppercase text-muted-ink">{UI_LAB_PREVIEW_ONLY}</p>
    </section>
  )
}
