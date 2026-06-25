import { DateTime } from 'https://esm.sh/luxon@3.5.0'

export const FOOTBALL_DATA_API_BASE = 'https://api.football-data.org/v4'
export const PL_COMPETITION_CODE = 'PL'
/** football-data.org season filter uses the season start year (2026/27 → 2026). */
export const LOS_SEASON_LABEL = '2026/27'
export const LOS_SEASON_YEAR = 2026

export type FootballDataTeam = {
  id: number
  name: string
  shortName?: string
  tla?: string
}

export type FootballDataMatch = {
  id: number
  utcDate: string
  status: string
  lastUpdated?: string
  homeTeam: FootballDataTeam
  awayTeam: FootballDataTeam
  score?: {
    fullTime?: { home: number | null; away: number | null }
    winner?: string | null
  }
}

export type FootballDataMatchesResponse = {
  matches?: FootballDataMatch[]
  resultSet?: {
    count?: number
    first?: string
    last?: string
    played?: number
  }
}

export type FootballDataCompetitionResponse = {
  id?: number
  name?: string
  code?: string
  currentSeason?: {
    id?: number
    startDate?: string
    endDate?: string
    currentMatchday?: number
  }
}

export type NormalizedProviderMatch = {
  providerFixtureId: string
  homeTeamId: string
  awayTeamId: string
  kickoffAt: string
  canonicalKey: string
  status: string
  homeScore: number | null
  awayScore: number | null
  resultStatus: string
  lastUpdated: string | null
  homeTeamName: string
  awayTeamName: string
}

export type ProviderReadinessResult = {
  keyAccepted: boolean
  httpStatus: number
  competitionCode: string
  competitionName: string | null
  currentSeasonStart: string | null
  currentSeasonEnd: string | null
  seasonYearRequested: number
  seasonMatchCount: number
  sampleMatch: {
    id: number
    utcDate: string
    status: string
    homeTeam: string
    awayTeam: string
    homeScore: number | null
    awayScore: number | null
    lastUpdated: string | null
  } | null
  unmappedTeamNames: string[]
  mappedTeamCount: number
  limitations: string[]
}

function authHeaders(apiKey: string): HeadersInit {
  return { 'X-Auth-Token': apiKey }
}

export async function footballDataFetch(
  apiKey: string,
  path: string,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const response = await fetch(`${FOOTBALL_DATA_API_BASE}${path}`, { headers: authHeaders(apiKey) })
  const json = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, json }
}

export function londonDateFromUtc(iso: string): string {
  return DateTime.fromISO(iso, { zone: 'utc' }).setZone('Europe/London').toISODate()!
}

export function canonicalKeyForMatch(season: string, homeId: string, awayId: string, kickoffUtc: string): string {
  return `${season}|${homeId}|${awayId}|${londonDateFromUtc(kickoffUtc)}`
}

export function mapFootballDataStatus(status: string): string {
  const map: Record<string, string> = {
    SCHEDULED: 'scheduled',
    TIMED: 'scheduled',
    IN_PLAY: 'in_play',
    PAUSED: 'in_play',
    FINISHED: 'finished',
    AWARDED: 'finished',
    POSTPONED: 'postponed',
    SUSPENDED: 'suspended',
    CANCELLED: 'cancelled',
  }
  return map[status] ?? 'scheduled'
}

export function mapFootballDataTeamToId(team: FootballDataTeam): string | null {
  const candidates = [team.name, team.shortName, team.tla].filter(Boolean) as string[]
  for (const name of candidates) {
    const id = mapTeamNameToId(name)
    if (id) return id
  }
  return null
}

export function mapTeamNameToId(name: string): string | null {
  const map: Record<string, string> = {
    Arsenal: 'ars',
    'Arsenal FC': 'ars',
    'Aston Villa': 'avl',
    'Aston Villa FC': 'avl',
    Bournemouth: 'bou',
    'AFC Bournemouth': 'bou',
    Brentford: 'bre',
    'Brentford FC': 'bre',
    Brighton: 'bha',
    'Brighton & Hove Albion': 'bha',
    'Brighton & Hove Albion FC': 'bha',
    'Brighton and Hove Albion': 'bha',
    Chelsea: 'che',
    'Chelsea FC': 'che',
    'Coventry City': 'cov',
    'Coventry City FC': 'cov',
    'Crystal Palace': 'cry',
    'Crystal Palace FC': 'cry',
    Everton: 'eve',
    'Everton FC': 'eve',
    Fulham: 'ful',
    'Fulham FC': 'ful',
    'Hull City': 'hul',
    'Hull City AFC': 'hul',
    'Ipswich Town': 'ips',
    'Ipswich Town FC': 'ips',
    'Leeds United': 'lee',
    Leeds: 'lee',
    'Leeds United FC': 'lee',
    Liverpool: 'liv',
    'Liverpool FC': 'liv',
    'Manchester City': 'mci',
    'Manchester City FC': 'mci',
    'Manchester United': 'mun',
    'Manchester United FC': 'mun',
    'Newcastle United': 'new',
    Newcastle: 'new',
    'Newcastle United FC': 'new',
    'Nottingham Forest': 'nfo',
    'Nottingham Forest FC': 'nfo',
    Sunderland: 'sun',
    'Sunderland AFC': 'sun',
    'Tottenham Hotspur': 'tot',
    Tottenham: 'tot',
    'Tottenham Hotspur FC': 'tot',
    ARS: 'ars',
    AVL: 'avl',
    BOU: 'bou',
    BRE: 'bre',
    BHA: 'bha',
    CHE: 'che',
    COV: 'cov',
    CRY: 'cry',
    EVE: 'eve',
    FUL: 'ful',
    HUL: 'hul',
    IPS: 'ips',
    LEE: 'lee',
    LIV: 'liv',
    MCI: 'mci',
    MUN: 'mun',
    NEW: 'new',
    NFO: 'nfo',
    SUN: 'sun',
    TOT: 'tot',
  }
  return map[name.trim()] ?? null
}

export function normalizeFootballDataMatch(match: FootballDataMatch): NormalizedProviderMatch | null {
  const homeTeamId = mapFootballDataTeamToId(match.homeTeam)
  const awayTeamId = mapFootballDataTeamToId(match.awayTeam)
  if (!homeTeamId || !awayTeamId) return null

  const status = mapFootballDataStatus(match.status)
  const homeScore = match.score?.fullTime?.home ?? null
  const awayScore = match.score?.fullTime?.away ?? null
  const kickoffAt = match.utcDate

  return {
    providerFixtureId: String(match.id),
    homeTeamId,
    awayTeamId,
    kickoffAt,
    canonicalKey: canonicalKeyForMatch(LOS_SEASON_LABEL, homeTeamId, awayTeamId, kickoffAt),
    status,
    homeScore,
    awayScore,
    resultStatus: status === 'finished' && homeScore != null && awayScore != null ? 'final' : 'pending',
    lastUpdated: match.lastUpdated ?? null,
    homeTeamName: match.homeTeam.name,
    awayTeamName: match.awayTeam.name,
  }
}

export async function fetchPremierLeagueCompetition(apiKey: string) {
  return footballDataFetch(apiKey, `/competitions/${PL_COMPETITION_CODE}`)
}

export async function fetchPremierLeagueSeasonMatches(
  apiKey: string,
  seasonYear = LOS_SEASON_YEAR,
  dateFrom?: string,
  dateTo?: string,
): Promise<{ ok: boolean; status: number; matches: FootballDataMatch[]; resultSet?: FootballDataMatchesResponse['resultSet'] }> {
  const params = new URLSearchParams({ season: String(seasonYear) })
  if (dateFrom) params.set('dateFrom', dateFrom)
  if (dateTo) params.set('dateTo', dateTo)
  const result = await footballDataFetch(apiKey, `/competitions/${PL_COMPETITION_CODE}/matches?${params}`)
  const payload = result.json as FootballDataMatchesResponse
  return {
    ok: result.ok,
    status: result.status,
    matches: payload.matches ?? [],
    resultSet: payload.resultSet,
  }
}

export async function checkFootballDataReadiness(apiKey: string): Promise<ProviderReadinessResult> {
  const limitations: string[] = [
    'Free tier: 10 requests/minute; use targeted season/date filters.',
    'Provider schedule may lag the official Premier League release for future seasons.',
  ]

  const competition = await fetchPremierLeagueCompetition(apiKey)
  if (!competition.ok) {
    return {
      keyAccepted: competition.status !== 403 && competition.status !== 401,
      httpStatus: competition.status,
      competitionCode: PL_COMPETITION_CODE,
      competitionName: null,
      currentSeasonStart: null,
      currentSeasonEnd: null,
      seasonYearRequested: LOS_SEASON_YEAR,
      seasonMatchCount: 0,
      sampleMatch: null,
      unmappedTeamNames: [],
      mappedTeamCount: 0,
      limitations: [
        ...limitations,
        competition.status === 403 ? 'API key rejected or competition not subscribed.' : `Competition HTTP ${competition.status}`,
      ],
    }
  }

  const comp = competition.json as FootballDataCompetitionResponse
  const seasonMatches = await fetchPremierLeagueSeasonMatches(apiKey, LOS_SEASON_YEAR)
  const unmapped = new Set<string>()
  let mappedTeamCount = 0

  for (const match of seasonMatches.matches) {
    if (!mapFootballDataTeamToId(match.homeTeam)) unmapped.add(match.homeTeam.name)
    else mappedTeamCount += 1
    if (!mapFootballDataTeamToId(match.awayTeam)) unmapped.add(match.awayTeam.name)
    else mappedTeamCount += 1
  }

  const normalized = seasonMatches.matches
    .map((m) => normalizeFootballDataMatch(m))
    .filter((m): m is NormalizedProviderMatch => m !== null)

  const first = normalized[0]
  const sampleMatch = first
    ? {
        id: Number(first.providerFixtureId),
        utcDate: first.kickoffAt,
        status: first.status,
        homeTeam: first.homeTeamName,
        awayTeam: first.awayTeamName,
        homeScore: first.homeScore,
        awayScore: first.awayScore,
        lastUpdated: first.lastUpdated,
      }
    : null

  if (seasonMatches.matches.length < 380) {
    limitations.push(
      `Season ${LOS_SEASON_YEAR} returned ${seasonMatches.matches.length} matches (expected up to 380 for a full schedule).`,
    )
  }

  return {
    keyAccepted: true,
    httpStatus: seasonMatches.status,
    competitionCode: PL_COMPETITION_CODE,
    competitionName: comp.name ?? null,
    currentSeasonStart: comp.currentSeason?.startDate ?? null,
    currentSeasonEnd: comp.currentSeason?.endDate ?? null,
    seasonYearRequested: LOS_SEASON_YEAR,
    seasonMatchCount: seasonMatches.matches.length,
    sampleMatch,
    unmappedTeamNames: [...unmapped].sort(),
    mappedTeamCount,
    limitations,
  }
}

export async function loadNormalizedSeasonMatches(
  apiKey: string,
  seasonYear = LOS_SEASON_YEAR,
): Promise<NormalizedProviderMatch[]> {
  const { matches } = await fetchPremierLeagueSeasonMatches(apiKey, seasonYear)
  return matches.map((m) => normalizeFootballDataMatch(m)).filter((m): m is NormalizedProviderMatch => m !== null)
}
