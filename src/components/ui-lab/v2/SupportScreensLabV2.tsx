import { useState } from 'react'
import { TeamChip } from '../../TeamChip'
import { formatHistorySeason, getHistorySummary } from '../../../config/history'
import { formatGBP } from '../../../lib/constants'
import { historyOutcomeNote } from '../../../lib/gameLifecycle'
import { adminEntryLabel } from '../../../lib/latePick'
import { formatPickCount } from '../../../lib/pickDistribution'
import { getPickStatusLabel, getPickSurvivalLabel } from '../../../lib/selections'
import { getTeamIdentity } from '../../../lib/teamIdentity'
import {
  UI_LAB_DEADLINE_RULE,
  formatRepeatWinnersForPreview,
  groupPicksByTeam,
  historyCardKind,
  historyCardLabel,
  rulesPreviewSections,
} from '../../../lib/uiLabPreview'
import type { HistoricalResult, SelectionWindow, WindowPickRow } from '../../../types'

export function PicksLabV2({
  roundLabel,
  window,
  rows,
}: {
  roundLabel: string
  window: SelectionWindow | null
  rows: WindowPickRow[]
}) {
  const [view, setView] = useState<'player' | 'team'>('player')
  const groups = groupPicksByTeam(rows)
  const submitted = rows.filter((row) => Boolean(row.team_id)).length

  return (
    <div className="grid gap-3">
      <section className="rounded-xl border border-[#381A54] bg-[#1C0C2D] p-4">
        <h2 className="text-sm font-semibold text-white">Everyone&apos;s picks</h2>
        <p className="mt-0.5 text-xs text-[#cfc3d0]">
          {roundLabel} · {submitted} submitted · display names only
        </p>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-[#14081F] p-1">
          <button
            type="button"
            className={['rounded-md py-2 text-xs font-semibold', view === 'player' ? 'bg-[#4e146b] text-white' : 'text-[#cfc3d0]'].join(' ')}
            onClick={() => setView('player')}
          >
            By player
          </button>
          <button
            type="button"
            className={['rounded-md py-2 text-xs font-semibold', view === 'team' ? 'bg-[#4e146b] text-white' : 'text-[#cfc3d0]'].join(' ')}
            onClick={() => setView('team')}
          >
            By team
          </button>
        </div>
      </section>
      {view === 'player' ? (
        <ul className="grid gap-2" data-testid="picks-by-player">
          {rows.map((row) => {
            const entryLabel = adminEntryLabel({
              adminCorrected: row.admin_corrected,
              submittedAt: row.updated_at,
              deadlineAt: window?.deadline_at,
            })
            return (
              <li key={row.player_id} className="flex items-center justify-between gap-2 rounded-xl border border-[#381A54] bg-[#200E32] p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{row.display_name}</p>
                  <p className="text-xs text-[#cfc3d0]">
                    {row.team_id ? getTeamIdentity(row.team_id).shortName : 'No team selected'}
                  </p>
                  <p className="text-xs text-[#cfc3d0]">{getPickStatusLabel(row, window)}</p>
                  <p className="text-xs text-[#cfc3d0]">{getPickSurvivalLabel(row)}</p>
                  {entryLabel ? <p className="text-[10px] text-[#caf300]">{entryLabel}</p> : null}
                </div>
                {row.team_id ? <TeamChip teamId={row.team_id} size="md" /> : <span className="text-xs text-[#ff7886]">No pick</span>}
              </li>
            )
          })}
        </ul>
      ) : (
        <ul className="grid gap-2" data-testid="picks-by-team">
          {groups.map((group) => (
            <li key={group.teamId} className="rounded-xl border border-[#381A54] bg-[#200E32] p-3">
              <div className="flex items-center gap-2">
                <TeamChip teamId={group.teamId} size="lg" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {group.teamName} ({group.count})
                  </p>
                  <p className="text-xs text-[#cfc3d0]">{group.playerNames.join(', ')}</p>
                </div>
                <span className="ml-auto text-sm font-semibold text-white">{formatPickCount(group.count)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.length === 0 ? <p className="text-sm text-[#cfc3d0]">No picks submitted yet.</p> : null}
    </div>
  )
}

export function HistoryLabV2({ history }: { history: HistoricalResult[] }) {
  const summary = getHistorySummary(history)
  const rows = [...history].reverse()
  return (
    <div className="grid gap-3">
      <section className="rounded-xl border border-[#381A54] bg-[#1C0C2D] p-4">
        <h2 className="text-sm font-semibold text-white">History</h2>
        <p className="text-xs text-[#cfc3d0]">{history.length} games</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Paid to winners" value={formatGBP(summary.totalPaidOut)} />
          <Stat
            label="Biggest win"
            value={summary.biggestWin ? `${formatGBP(summary.biggestWin.pot)} · G${summary.biggestWin.game_number}` : 'None'}
          />
          <Stat label="Rollovers" value={String(summary.rolloverCount)} />
          <Stat label="Repeat winners" value={formatRepeatWinnersForPreview(summary.repeatWinners)} />
        </div>
      </section>
      <ul className="grid gap-2">
        {rows.map((row) => {
          const kind = historyCardKind(row.result_type)
          return (
            <li key={row.id} className="rounded-xl border border-[#381A54] bg-[#200E32] p-4" data-history-kind={kind}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">Game {row.game_number}</p>
                  <p className="text-xs text-[#cfc3d0]">{formatHistorySeason(row)}</p>
                </div>
                <span
                  className={[
                    'rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                    kind === 'winner-paid' ? 'bg-[#00e5a3]/20 text-[#00e5a3]' : kind === 'rollover' ? 'bg-[#ffc107]/20 text-[#ffc107]' : 'text-[#cfc3d0]',
                  ].join(' ')}
                >
                  {historyCardLabel(kind)}
                </span>
              </div>
              <p className="mt-2 text-sm text-white">
                {kind === 'winner-paid'
                  ? `Winner: ${row.winner_name ?? 'Winner'}`
                  : kind === 'rollover'
                    ? 'Pot rolled over'
                    : 'In play'}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[#ffc107]">{formatGBP(row.pot)}</p>
              <p className="mt-1 text-xs text-[#cfc3d0]">{historyOutcomeNote(row)}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function RulesLabV2() {
  const sections = rulesPreviewSections()
  return (
    <div className="grid gap-3">
      <section className="rounded-xl border border-[#381A54] bg-[#1C0C2D] p-4">
        <h2 className="text-sm font-semibold text-white">Rules</h2>
        <p className="mt-1 text-sm text-[#cfc3d0]">{UI_LAB_DEADLINE_RULE}</p>
      </section>
      {sections.map((section) => (
        <article key={section.title} className="rounded-xl border border-[#381A54] bg-[#200E32] p-4">
          <h3 className="text-sm font-semibold text-white">{section.title}</h3>
          <ul className="mt-2 grid gap-1.5">
            {section.items.map((item) => (
              <li key={item} className="text-sm text-[#f0dbfc]">
                {item}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#351750] bg-[#200E32] p-2.5">
      <p className="text-[10px] uppercase text-[#cfc3d0]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
