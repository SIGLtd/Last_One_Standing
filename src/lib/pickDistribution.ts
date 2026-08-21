import { TEAM_ID_TO_NAME } from '../config/teams'
import { getTeamIdentity } from './teamIdentity'

export type PickDistributionRow = {
  teamId: string
  teamName: string
  count: number
  percent: number
}

export function buildPickDistribution(teamIds: Array<string | null | undefined>): PickDistributionRow[] {
  const submitted = teamIds.filter((teamId): teamId is string => Boolean(teamId))
  const total = submitted.length
  if (total === 0) return []

  const counts = new Map<string, number>()
  for (const teamId of submitted) {
    counts.set(teamId, (counts.get(teamId) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([teamId, count]) => ({
      teamId,
      teamName: TEAM_ID_TO_NAME.get(teamId) ?? teamId,
      count,
      percent: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.teamName.localeCompare(b.teamName))
}

export function formatPickCount(count: number): string {
  return count === 1 ? '1 pick' : `${count} picks`
}

export function formatTopPicksSummary(rows: PickDistributionRow[], limit = 3): string {
  if (rows.length === 0) return 'No picks yet'
  const parts = rows.slice(0, limit).map((row) => {
    const shortName = getTeamIdentity(row.teamId).shortName
    return `${shortName} ${row.percent}%`
  })
  return `Most picked: ${parts.join(', ')}`
}
