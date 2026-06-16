import type { Team } from '../types'

export const TEAMS_2026: Team[] = [
  { id: 'ars', name: 'Arsenal' },
  { id: 'avl', name: 'Aston Villa' },
  { id: 'bou', name: 'Bournemouth' },
  { id: 'bre', name: 'Brentford' },
  { id: 'bha', name: 'Brighton & Hove Albion' },
  { id: 'che', name: 'Chelsea' },
  { id: 'cry', name: 'Crystal Palace' },
  { id: 'eve', name: 'Everton' },
  { id: 'ful', name: 'Fulham' },
  { id: 'ips', name: 'Ipswich Town' },
  { id: 'lei', name: 'Leicester City' },
  { id: 'liv', name: 'Liverpool' },
  { id: 'mci', name: 'Manchester City' },
  { id: 'mun', name: 'Manchester United' },
  { id: 'new', name: 'Newcastle United' },
  { id: 'nfo', name: 'Nottingham Forest' },
  { id: 'sou', name: 'Southampton' },
  { id: 'tot', name: 'Tottenham Hotspur' },
  { id: 'whu', name: 'West Ham United' },
  { id: 'wol', name: 'Wolverhampton Wanderers' },
]

export const TEAM_ID_TO_NAME = new Map(TEAMS_2026.map((t) => [t.id, t.name] as const))

