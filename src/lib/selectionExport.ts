import { TEAM_ID_TO_NAME } from '../config/teams'
import type { GameEntryWithPlayer, Selection, SelectionWindowEligibleFixture } from '../types'
import { formatDeadlineLondon } from './fixtureOps'

export type SelectionExportRow = {
  playerName: string
  teamName: string
  fixtureLabel: string
  submittedAt: string | null
  paymentStatus: string
  active: boolean
  adminEntered: boolean
}

export type SelectionExportInput = {
  roundLabel: string
  deadlineAt: string
  rows: SelectionExportRow[]
}

function fixtureLabelForTeam(
  teamId: string,
  fixtures: SelectionWindowEligibleFixture[],
): string {
  const fixture = fixtures.find((row) => row.home_team_id === teamId || row.away_team_id === teamId)
  if (!fixture) return '—'
  return `${fixture.home_team_name} v ${fixture.away_team_name}`
}

export function paymentStatusLabel(entry: GameEntryWithPlayer | undefined): string {
  if (!entry) return 'No entry'
  if (entry.paid) return 'Paid'
  if (entry.payment_claimed) return 'Awaiting verify'
  return 'Unpaid'
}

export function buildSelectionExportRows(input: {
  selections: Selection[]
  entries: GameEntryWithPlayer[]
  fixtures: SelectionWindowEligibleFixture[]
  game: { standard_entry_fee: number; newbie_entry_fee: number }
}): SelectionExportRow[] {
  const entryByPlayer = new Map(input.entries.map((entry) => [entry.player_id, entry]))

  return input.selections
    .filter((selection) => Boolean(selection.team_id))
    .map((selection) => {
      const entry = entryByPlayer.get(selection.player_id)
      const teamId = selection.team_id as string
      return {
        playerName: entry?.player.display_name ?? 'Unknown player',
        teamName: TEAM_ID_TO_NAME.get(teamId) ?? teamId,
        fixtureLabel: fixtureLabelForTeam(teamId, input.fixtures),
        submittedAt: selection.updated_at ?? selection.created_at,
        paymentStatus: paymentStatusLabel(entry),
        active: entry?.status === 'active',
        adminEntered: Boolean(selection.admin_corrected),
      }
    })
    .sort((a, b) => a.playerName.localeCompare(b.playerName))
}

export function buildWhatsAppSelectionSummary(input: SelectionExportInput): string {
  const deadline = formatDeadlineLondon(input.deadlineAt)
  const lines = [
    `${input.roundLabel} selections so far`,
    `Deadline: ${deadline}`,
    `Picks submitted: ${input.rows.length}`,
    '',
  ]

  for (const row of input.rows) {
    const adminMark = row.adminEntered ? ' (admin entered)' : ''
    lines.push(`${row.playerName} - ${row.teamName}${adminMark}`)
  }

  const grouped = new Map<string, string[]>()
  for (const row of input.rows) {
    const names = grouped.get(row.teamName) ?? []
    names.push(row.playerName)
    grouped.set(row.teamName, names)
  }

  if (grouped.size > 0) {
    lines.push('', 'By team')
    for (const teamName of [...grouped.keys()].sort((a, b) => a.localeCompare(b))) {
      lines.push(`${teamName}: ${grouped.get(teamName)?.join(', ')}`)
    }
  }

  return lines.join('\n')
}

export function buildSelectionCsv(input: SelectionExportInput): string {
  const header = [
    'Round',
    'Deadline',
    'Player',
    'Team',
    'Fixture',
    'Submitted at',
    'Payment',
    'Active',
    'Admin entered',
  ]

  const rows = input.rows.map((row) =>
    [
      input.roundLabel,
      formatDeadlineLondon(input.deadlineAt),
      row.playerName,
      row.teamName,
      row.fixtureLabel,
      row.submittedAt ?? '',
      row.paymentStatus,
      row.active ? 'Y' : 'N',
      row.adminEntered ? 'Y' : 'N',
    ]
      .map(csvCell)
      .join(','),
  )

  return [header.join(','), ...rows].join('\n')
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

export function downloadTextFile(filename: string, contents: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
