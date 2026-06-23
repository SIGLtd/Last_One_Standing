import type { Team } from '../types'

/** 2026/27 Premier League teams — aligned with data/fixtures/2026-27/teams.json */
export const TEAMS_2026: Team[] = [
  { id: 'ars', name: 'Arsenal' },
  { id: 'avl', name: 'Aston Villa' },
  { id: 'bou', name: 'AFC Bournemouth' },
  { id: 'bre', name: 'Brentford' },
  { id: 'bha', name: 'Brighton & Hove Albion' },
  { id: 'che', name: 'Chelsea' },
  { id: 'cov', name: 'Coventry City' },
  { id: 'cry', name: 'Crystal Palace' },
  { id: 'eve', name: 'Everton' },
  { id: 'ful', name: 'Fulham' },
  { id: 'hul', name: 'Hull City' },
  { id: 'ips', name: 'Ipswich Town' },
  { id: 'lee', name: 'Leeds United' },
  { id: 'liv', name: 'Liverpool' },
  { id: 'mci', name: 'Manchester City' },
  { id: 'mun', name: 'Manchester United' },
  { id: 'new', name: 'Newcastle United' },
  { id: 'nfo', name: 'Nottingham Forest' },
  { id: 'sun', name: 'Sunderland' },
  { id: 'tot', name: 'Tottenham Hotspur' },
]

export const TEAM_ID_TO_NAME = new Map(TEAMS_2026.map((t) => [t.id, t.name] as const))
