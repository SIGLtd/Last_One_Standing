import { TEAM_ID_TO_NAME } from '../config/teams'
import { getSupabaseOrThrow } from './supabase'
import { operationalWindowToRoundLabel } from './round1'
import { MIN_OPERATIONAL_WINDOW_NUMBER } from './windowGuards'
import type { Selection } from '../types'

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
}

type HistoryQueryRow = Selection & {
  window: { window_number: number; status: string; deadline_at: string } | { window_number: number; status: string; deadline_at: string }[] | null
  fixture: { home_team_id: string; away_team_id: string } | { home_team_id: string; away_team_id: string }[] | null
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export function buildPickHistoryRows(rows: HistoryQueryRow[], nowMs = Date.now()): PickHistoryRow[] {
  return rows
    .map((row) => {
      const window = unwrap(row.window)
      const fixture = unwrap(row.fixture)
      const windowNumber = window?.window_number ?? 0
      const teamName = row.team_id ? (TEAM_ID_TO_NAME.get(row.team_id) ?? row.team_id) : '—'
      const fixtureLabel = fixture
        ? `${TEAM_ID_TO_NAME.get(fixture.home_team_id) ?? fixture.home_team_id} v ${TEAM_ID_TO_NAME.get(fixture.away_team_id) ?? fixture.away_team_id}`
        : '—'
      const deadlinePassed = window ? new Date(window.deadline_at).getTime() <= nowMs : false
      const usedFinal =
        Boolean(row.team_id) &&
        windowNumber >= MIN_OPERATIONAL_WINDOW_NUMBER &&
        (window?.status === 'locked' || window?.status === 'resolved' || Boolean(row.locked_at) || deadlinePassed)

      let statusLabel = 'Submitted'
      if (!row.team_id) statusLabel = 'No pick'
      else if (usedFinal) statusLabel = 'Used / final'
      else if (row.locked_at) statusLabel = 'Locked'
      else statusLabel = 'Current'

      return {
        selectionId: row.id,
        playerId: row.player_id,
        windowNumber,
        roundLabel: windowNumber ? operationalWindowToRoundLabel(windowNumber) : 'Unknown round',
        teamId: row.team_id,
        teamName,
        fixtureLabel,
        submittedAt: row.updated_at ?? row.created_at,
        statusLabel,
        usedFinal,
        adminEntered: Boolean(row.admin_corrected),
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
      fixture:season_fixtures ( home_team_id, away_team_id )
    `,
    )
    .eq('player_id', playerId)
    .eq('game_id', gameId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return buildPickHistoryRows((data ?? []) as HistoryQueryRow[])
}
