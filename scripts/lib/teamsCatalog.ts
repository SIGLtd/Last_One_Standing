export type TeamCatalogEntry = {
  id: string
  name: string
  pl_names: string[]
}

export const SEASON = '2026/27'

export const TEAM_CATALOG: TeamCatalogEntry[] = [
  { id: 'ars', name: 'Arsenal', pl_names: ['Arsenal'] },
  { id: 'avl', name: 'Aston Villa', pl_names: ['Aston Villa'] },
  { id: 'bou', name: 'AFC Bournemouth', pl_names: ['AFC Bournemouth'] },
  { id: 'bre', name: 'Brentford', pl_names: ['Brentford'] },
  { id: 'bha', name: 'Brighton & Hove Albion', pl_names: ['Brighton & Hove Albion', 'Brighton and Hove Albion'] },
  { id: 'che', name: 'Chelsea', pl_names: ['Chelsea'] },
  { id: 'cov', name: 'Coventry City', pl_names: ['Coventry City'] },
  { id: 'cry', name: 'Crystal Palace', pl_names: ['Crystal Palace'] },
  { id: 'eve', name: 'Everton', pl_names: ['Everton'] },
  { id: 'ful', name: 'Fulham', pl_names: ['Fulham'] },
  { id: 'hul', name: 'Hull City', pl_names: ['Hull City'] },
  { id: 'ips', name: 'Ipswich Town', pl_names: ['Ipswich Town'] },
  { id: 'lee', name: 'Leeds United', pl_names: ['Leeds United'] },
  { id: 'liv', name: 'Liverpool', pl_names: ['Liverpool'] },
  { id: 'mci', name: 'Manchester City', pl_names: ['Manchester City', 'Man City'] },
  { id: 'mun', name: 'Manchester United', pl_names: ['Manchester United', 'Man Utd'] },
  { id: 'new', name: 'Newcastle United', pl_names: ['Newcastle United'] },
  { id: 'nfo', name: 'Nottingham Forest', pl_names: ['Nottingham Forest', "Nott'm Forest"] },
  { id: 'sun', name: 'Sunderland', pl_names: ['Sunderland'] },
  { id: 'tot', name: 'Tottenham Hotspur', pl_names: ['Tottenham Hotspur', 'Spurs'] },
]

const plNameToId = new Map<string, string>()
for (const team of TEAM_CATALOG) {
  for (const plName of team.pl_names) {
    plNameToId.set(plName, team.id)
  }
}

export function resolveTeamId(plName: string): string | null {
  return plNameToId.get(plName.trim()) ?? null
}

export function canonicalKey(season: string, homeId: string, awayId: string, kickoffUtc: string): string {
  const day = kickoffUtc.slice(0, 10)
  return `${season}|${homeId}|${awayId}|${day}`
}
