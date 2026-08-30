import { TEAM_ID_TO_NAME } from '../config/teams'
import { adminEntryLabel } from './latePick'
import { getSupabaseOrThrow } from './supabase'
import { operationalWindowToRoundLabel } from './round1'
import { MIN_OPERATIONAL_WINDOW_NUMBER } from './windowGuards'
import type { Selection, SelectionOutcome } from '../types'

export type PickHistoryRow = {
  selectionId: string
  playerId: string
  windowNumber: number
  roundLabel: string
  teamId: string | null
  teamName: string
  fixtureLabel: string
  submittedAt: string | null
  statusLabel: string
  usedFinal: boolean
  adminEntered: boolean
  adminEntryLabel: string | null
  outcome: SelectionOutcome | null
  scoreLabel: string
}

type HistoryQueryRow = Selection & {
  window: { window_number: number; status: string; deadline_at: string } | { window_number: number; status: string; deadline_at: string }[] | null
  fixture:
    | { home_team_id: string; away_team_id: string; home_score?: number | null; away_score?: number | null; status?: string }
    | { home_team_id: string; away_team_id: string; home_score?: number | null; away_score?: number | null; status?: string }[]
    | null
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function outcomeStatusLabel(outcome: SelectionOutcome | null | undefined, usedFinal: boolean, teamId: string | null, locked: boolean): string {
  if (outcome === 'survived') return 'Survived'
  if (outcome === 'eliminated') return 'Eliminated 💀'
  if (outcome === 'no_pick' || !teamId) return teamId ? 'Submitted' : outcome === 'no_pick' ? 'No pick 💀' : 'No pick'
  if (outcome === 'pending') return 'Pending'
  if (usedFinal) return 'Used / final'
  if (locked) return 'Locked'
  return 'Current'
}

export function buildPickHistoryRows(rows: HistoryQueryRow[], _nowMs = Date.now()): PickHistoryRow[] {
  return rows
    .map((row) => {
      const window = unwrap(row.window)
      const fixture = unwrap(row.fixture)
      const windowNumber = window?.window_number ?? 0
      const teamName = row.team_id ? (TEAM_ID_TO_NAME.get(row.team_id) ?? row.team_id) : '—'
      const fixtureLabel = fixture
        ? `${TEAM_ID_TO_NAME.get(fixture.home_team_id) ?? fixture.home_team_id} v ${TEAM_ID_TO_NAME.get(fixture.away_team_id) ?? fixture.away_team_id}`
        : '—'
      const usedFinal =
        Boolean(row.used_final) ||
        (Boolean(row.team_id) && windowNumber >= MIN_OPERATIONAL_WINDOW_NUMBER && window?.status === 'resolved')
      const scoreLabel =
        fixture && fixture.home_score != null && fixture.away_score != null
          ? `${fixture.home_score}–${fixture.away_score}`
          : '—'

      return {
        selectionId: row.id,
        playerId: row.player_id,
        windowNumber,
        roundLabel: windowNumber ? operationalWindowToRoundLabel(windowNumber) : 'Unknown round',
        teamId: row.team_id,
        teamName,
        fixtureLabel,
        submittedAt: row.updated_at ?? row.created_at,
        statusLabel: outcomeStatusLabel(row.outcome ?? null, usedFinal, row.team_id, Boolean(row.locked_at) || window?.status === 'locked'),
        usedFinal,
        adminEntered: Boolean(row.admin_corrected),
        adminEntryLabel: adminEntryLabel({
          adminCorrected: row.admin_corrected,
          submittedAt: row.updated_at ?? row.created_at,
          deadlineAt: window?.deadline_at,
        }),
        outcome: row.outcome ?? null,
        scoreLabel,
      }
    })
    .sort((a, b) => b.windowNumber - a.windowNumber)
}

export async function fetchMyPickHistory(playerId: string, gameId: string): Promise<PickHistoryRow[]> {
  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('selections')
    .select(
      `
      *,
      window:selection_windows ( window_number, status, deadline_at ),
      fixture:season_fixtures ( home_team_id, away_team_id, home_score, away_score, status )
    `,
    )
    .eq('player_id', playerId)
    .eq('game_id', gameId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return buildPickHistoryRows((data ?? []) as HistoryQueryRow[])
}
