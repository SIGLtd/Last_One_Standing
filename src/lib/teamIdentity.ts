import { TEAMS_2026 } from '../config/teams'

export type TeamKitStyle = 'solid' | 'stripe'

export type TeamIdentity = {
  teamId: string
  initials: string
  shortName: string
  primary: string
  secondary: string
  textOnPrimary: string
  kit: TeamKitStyle
}

const FALLBACK: Omit<TeamIdentity, 'teamId'> = {
  initials: 'LOS',
  shortName: 'Unknown',
  primary: '#37003c',
  secondary: '#00ffea',
  textOnPrimary: '#ffffff',
  kit: 'solid',
}

const SHORT_NAMES: Record<string, string> = {
  ars: 'Arsenal',
  avl: 'Villa',
  bou: 'Bournemouth',
  bre: 'Brentford',
  bha: 'Brighton',
  che: 'Chelsea',
  cov: 'Coventry',
  cry: 'Palace',
  eve: 'Everton',
  ful: 'Fulham',
  hul: 'Hull',
  ips: 'Ipswich',
  lee: 'Leeds',
  liv: 'Liverpool',
  mci: 'Man City',
  mun: 'Man United',
  new: 'Newcastle',
  nfo: 'Forest',
  sun: 'Sunderland',
  tot: 'Tottenham',
}

const COLOURS: Record<string, { primary: string; secondary: string; kit?: TeamKitStyle }> = {
  ars: { primary: '#EF0107', secondary: '#FFFFFF' },
  avl: { primary: '#670E36', secondary: '#95BFE5' },
  bou: { primary: '#DA291C', secondary: '#000000' },
  bre: { primary: '#E30613', secondary: '#FBB034' },
  bha: { primary: '#0057B8', secondary: '#FFFFFF' },
  che: { primary: '#034694', secondary: '#FFFFFF' },
  cov: { primary: '#59B5E3', secondary: '#1C3667' },
  cry: { primary: '#1B458F', secondary: '#C4122E', kit: 'stripe' },
  eve: { primary: '#003399', secondary: '#FFFFFF' },
  ful: { primary: '#000000', secondary: '#FFFFFF' },
  hul: { primary: '#F5A12D', secondary: '#000000', kit: 'stripe' },
  ips: { primary: '#0033A0', secondary: '#DE2C37' },
  lee: { primary: '#FFCD00', secondary: '#1D428A' },
  liv: { primary: '#C8102E', secondary: '#00B2A9' },
  mci: { primary: '#6CABDD', secondary: '#1C2C5B' },
  mun: { primary: '#DA291C', secondary: '#FBE122' },
  new: { primary: '#241F20', secondary: '#FFFFFF' },
  nfo: { primary: '#DD0000', secondary: '#FFFFFF' },
  sun: { primary: '#EB172B', secondary: '#FFFFFF' },
  tot: { primary: '#132257', secondary: '#FFFFFF' },
}

function hexLuminance(hex: string): number {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) return 0
  const r = Number.parseInt(cleaned.slice(0, 2), 16) / 255
  const g = Number.parseInt(cleaned.slice(2, 4), 16) / 255
  const b = Number.parseInt(cleaned.slice(4, 6), 16) / 255
  const channel = (value: number) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function textOn(hex: string): string {
  return hexLuminance(hex) > 0.45 ? '#14121a' : '#ffffff'
}

export function getTeamIdentity(teamId: string | null | undefined): TeamIdentity {
  const id = (teamId ?? '').trim().toLowerCase()
  if (!id) {
    return { teamId: 'unknown', ...FALLBACK }
  }

  const colours = COLOURS[id]
  const primary = colours?.primary ?? FALLBACK.primary
  return {
    teamId: id,
    initials: id.slice(0, 3).toUpperCase(),
    shortName: SHORT_NAMES[id] ?? FALLBACK.shortName,
    primary,
    secondary: colours?.secondary ?? FALLBACK.secondary,
    textOnPrimary: textOn(primary),
    kit: colours?.kit ?? 'solid',
  }
}

export function teamIdentityFallbackSafe(teamId: string | null | undefined): boolean {
  const identity = getTeamIdentity(teamId)
  return Boolean(identity.primary && identity.initials && identity.shortName)
}

export function allKnownTeamsHaveIdentity(): boolean {
  return TEAMS_2026.every((team) => {
    const identity = getTeamIdentity(team.id)
    return identity.shortName !== FALLBACK.shortName && Boolean(COLOURS[team.id])
  })
}
