import { TEAM_ID_TO_NAME } from '../config/teams'

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

export function formatPickDistributionLine(row: PickDistributionRow): string {
  const pickLabel = row.count === 1 ? 'pick' : 'picks'
  return `${row.teamName} — ${row.count} ${pickLabel} — ${row.percent}%`
}
