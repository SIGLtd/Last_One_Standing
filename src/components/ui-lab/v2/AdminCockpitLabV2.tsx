import { useState } from 'react'
import { TeamChip } from '../../TeamChip'
import { REINSTATE_REASON_EXAMPLE } from '../../../lib/playerReinstatement'
import { ROUND_EDIT_REASON_EXAMPLE } from '../../../lib/roundWindowEdit'
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
} from '../../../lib/uiLabPreview'
import { getTeamIdentity } from '../../../lib/teamIdentity'

const SECTION_HINTS: Record<AdminPreviewSection, string> = {
  overview: '& action',
  scores: '& sync',
  picks: '& audit',
  corrections: 'tools',
  lifecycle: 'gate',
  comms: '& WhatsApp',
}

export function AdminCockpitLabV2({
  overview,
  windowStatus,
  gameStatus,
  survivorCount,
  fixtureCount,
}: {
  overview: AdminOverviewModel
  windowStatus: string | null
  gameStatus: string | null
  survivorCount: number
  fixtureCount: number
}) {
  const [section, setSection] = useState<AdminPreviewSection>('overview')
  const [gateOpen, setGateOpen] = useState(false)
  const gate = settlementGateState({ gameStatus, survivorCount })
  const steps = roundProgressionSteps({
    windowStatus,
    deadlineLabel: `${overview.deadlineLabel}. ${UI_LAB_DEADLINE_RULE}`,
    survivorCount,
    gameStatus,
  })
  const unpicked = Math.max(overview.survivorCount - overview.picksSubmitted, 0)
  const submittedShare =
    overview.survivorCount > 0 ? Math.round((overview.picksSubmitted / overview.survivorCount) * 100) : 0

  return (
    <div className="grid gap-3">
      <div>
        <p className="lab-label text-[11px] uppercase tracking-wider text-[#caf300]">Live round control</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Admin Cockpit</h2>
        <p className="mt-1 text-sm text-[#cfc3d0]">Preview only. Live actions stay on Admin.</p>
      </div>

      <nav className="lab-well grid grid-cols-3 gap-1 rounded-xl p-1">
        {ADMIN_PREVIEW_SECTIONS.map((item) => (
          <button
            key={item}
            type="button"
            className={[
              'rounded-lg px-1 py-2 text-[11px] font-semibold',
              section === item
                ? 'border border-[#e7b3ff]/40 bg-[#4e146b] text-white'
                : 'text-[#cfc3d0]',
            ].join(' ')}
            onClick={() => setSection(item)}
          >
            <span className="block">{ADMIN_PREVIEW_SECTION_LABELS[item]}</span>
            <span className="block text-[10px] opacity-75">{SECTION_HINTS[item]}</span>
          </button>
        ))}
      </nav>

      {section === 'overview' ? (
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            <Metric tile="Survivors" value={String(overview.survivorCount)} hint="Active" />
            <Metric tile="Pot tally" value={overview.potLabel} hint="Verified" gold />
            <Metric tile="Fixtures" value={String(fixtureCount)} hint="Sat/Sun" />
          </div>
          <section className="lab-hero relative overflow-hidden rounded-xl p-3.5">
            <p className="text-[15px] font-bold text-white">{overview.roundLabel} in progress</p>
            <p className="mt-1 text-sm text-[#cfc3d0]">
              {overview.picksSubmitted} of {overview.survivorCount} picks in. {unpicked} still to pick.
            </p>
            <p className="mt-1 text-sm font-semibold text-white">{overview.nextAction}</p>
            <div className="lab-well mt-3 h-2.5 overflow-hidden rounded-full">
              <div className="h-full bg-[#00e5a3]" style={{ width: `${submittedShare}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-[#cfc3d0]">Deadline {overview.deadlineLabel}</p>
            <button
              type="button"
              className="lab-chip mt-3 flex w-full items-center justify-center rounded-lg py-3 text-sm font-semibold text-white"
              disabled
            >
              {UI_LAB_PREVIEW_ONLY}
            </button>
          </section>
          {overview.warnings.map((warning) => (
            <div key={warning} className="lab-tint-gold rounded-xl p-3 text-sm text-[#ffc107]">
              {warning}
            </div>
          ))}
        </div>
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
        <div className="grid gap-3">
          <section className="lab-card rounded-xl p-3.5" data-testid="round-progression-gate">
            <h3 className="lab-label text-[12px] uppercase tracking-wider text-white">Round progression gate</h3>
            <p className="mt-1 text-xs text-[#cfc3d0]">{overview.deadlineRule}</p>
            <ol className="mt-3 grid gap-2">
              {steps.map((step) => (
                <li key={step.title} className="lab-row rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">{step.title}</span>
                    <span className="lab-label text-[10px] uppercase text-[#00e5a3]">{step.state}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#cfc3d0]">{step.detail}</p>
                </li>
              ))}
            </ol>
          </section>
          <section className="lab-card rounded-xl p-3.5" data-testid="settlement-gate">
            <h3 className="text-sm font-bold text-white">Game settlement gate</h3>
            <p className="mt-1 text-sm font-semibold text-white">{gate.label}</p>
            <p className="mt-1 text-sm text-[#cfc3d0]">{gate.reason}</p>
            <button
              type="button"
              className="lab-well mt-3 w-full rounded-lg py-2.5 text-sm text-white"
              onClick={() => setGateOpen((open) => !open)}
            >
              {gateOpen ? 'Hide settlement controls' : 'Settlement safety gate (protected)'}
            </button>
            {gateOpen ? (
              <div className={['mt-3 grid grid-cols-2 gap-2', gate.unlocked ? '' : 'opacity-50'].join(' ')}>
                <div className="lab-tint-gold rounded-lg p-3">
                  <p className="text-sm font-semibold text-white">Winner paid</p>
                  <p className="mt-1 text-xs text-[#cfc3d0]">Disburse {overview.potLabel}</p>
                  <button type="button" className="mt-2 w-full rounded bg-[#44115e] py-1.5 text-xs text-white" disabled>
                    {UI_LAB_PREVIEW_ONLY}
                  </button>
                </div>
                <div className="lab-tint-lavender rounded-lg p-3">
                  <p className="text-sm font-semibold text-white">Rollover pot</p>
                  <p className="mt-1 text-xs text-[#cfc3d0]">Carry into the next game</p>
                  <button type="button" className="mt-2 w-full rounded bg-[#44115e] py-1.5 text-xs text-white" disabled>
                    {UI_LAB_PREVIEW_ONLY}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
      {section === 'comms' ? (
        <Placeholder title="Comms" body="WhatsApp reminders stay on the live Admin page." />
      ) : null}
    </div>
  )
}

function Metric({
  tile,
  value,
  hint,
  gold,
}: {
  tile: string
  value: string
  hint: string
  gold?: boolean
}) {
  return (
    <div className={['rounded-xl p-3', gold ? 'lab-tint-gold' : tile === 'Survivors' ? 'lab-tint-teal' : 'lab-tint-lavender'].join(' ')}>
      <p className="text-[11px] text-[#cfc3d0]">{tile}</p>
      <p className={['mt-1 text-lg font-bold', gold ? 'text-[#ffb95f]' : 'text-white'].join(' ')}>{value}</p>
      <p className="text-[10px] text-[#00e5a3]">{hint}</p>
    </div>
  )
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <section className="lab-card rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-[#cfc3d0]">{body}</p>
      <p className="mt-2 text-xs font-semibold uppercase text-[#caf300]">{UI_LAB_PREVIEW_ONLY}</p>
    </section>
  )
}

function CorrectionsPreview({ overview }: { overview: AdminOverviewModel }) {
  const brighton = getTeamIdentity('bha')
  return (
    <div className="grid gap-3">
      <article className="lab-card rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white">Reinstate player</h3>
        <p className="mt-1 text-sm text-[#cfc3d0]">{REINSTATE_PREVIEW_COPY}</p>
        <p className="mt-2 text-xs text-[#cfc3d0]">Do not create duplicate picks. Existing used teams stay used.</p>
        <p className="mt-2 text-xs text-[#cfc3d0]">
          Game: {overview.gameLabel} · Round: {overview.roundLabel}
        </p>
        <div className="lab-chip mt-2 inline-flex items-center gap-2 rounded-md px-2 py-1">
          <TeamChip teamId="bha" size="sm" />
          <span className="text-xs text-white">{brighton.shortName} already used if that pick counted</span>
        </div>
        <textarea className="lab-well mt-3 w-full rounded-lg p-2 text-xs text-white" disabled defaultValue={REINSTATE_REASON_EXAMPLE} />
        <button type="button" className="mt-3 w-full rounded-lg bg-[#caf300] py-2 text-sm font-bold text-[#14081F]" disabled>
          {UI_LAB_PREVIEW_ONLY}
        </button>
      </article>
      <article className="lab-card rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white">Edit current round</h3>
        <p className="mt-1 text-sm text-[#cfc3d0]">{ROUND_EDIT_PREVIEW_COPY}</p>
        <p className="mt-2 text-sm text-white">Current deadline: {overview.deadlineLabel}</p>
        <p className="mt-1 text-xs text-[#cfc3d0]">{UI_LAB_DEADLINE_RULE}</p>
        <textarea className="lab-well mt-3 w-full rounded-lg p-2 text-xs text-white" disabled defaultValue={ROUND_EDIT_REASON_EXAMPLE} />
        <button type="button" className="mt-3 w-full rounded-lg bg-[#caf300] py-2 text-sm font-bold text-[#14081F]" disabled>
          {UI_LAB_PREVIEW_ONLY}
        </button>
      </article>
      <article className="lab-card rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white">Accepted late pick</h3>
        <p className="mt-1 text-sm text-[#cfc3d0]">
          Organiser-approved late entry after the deadline. Marked and audited. Preview only.
        </p>
        <button type="button" className="mt-3 w-full rounded-lg bg-[#caf300] py-2 text-sm font-bold text-[#14081F]" disabled>
          {UI_LAB_PREVIEW_ONLY}
        </button>
      </article>
    </div>
  )
}
