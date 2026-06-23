import { TEAM_CATALOG, canonicalKey, resolveTeamId, SEASON } from './teamsCatalog'

export type FixtureArtefactRow = {
  source_fixture_id: string | null
  canonical_key: string
  season: string
  home_team_id: string
  away_team_id: string
  kickoff_at: string
  original_kickoff_at: string
  kickoff_london: string
  home_team_name: string
  away_team_name: string
}

export type ValidationResult = {
  ok: boolean
  errors: string[]
  warnings: string[]
  stats: {
    fixtureCount: number
    teamCount: number
    homeCounts: Record<string, number>
    awayCounts: Record<string, number>
    duplicateKeys: string[]
  }
}

export function kickoffToLondonIso(kickoffUtc: string): string {
  const date = new Date(kickoffUtc)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:00`
}

export function londonDayOfWeek(kickoffUtc: string): number {
  const weekday = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
  }).format(new Date(kickoffUtc))

  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  return map[weekday] ?? 0
}

export function londonDateFromKickoff(kickoffUtc: string): string {
  return kickoffToLondonIso(kickoffUtc).slice(0, 10)
}

export type SampleWeekendCheck = {
  label: string
  sat: string
  sun: string
  minFixtures: number
}

export const SAMPLE_WEEKEND_CHECKS: SampleWeekendCheck[] = [
  { label: 'opening weekend', sat: '2026-08-22', sun: '2026-08-23', minFixtures: 1 },
  { label: 'autumn weekend', sat: '2026-10-10', sun: '2026-10-11', minFixtures: 1 },
  { label: 'christmas period', sat: '2026-12-26', sun: '2026-12-27', minFixtures: 1 },
  { label: 'spring weekend', sat: '2027-03-20', sun: '2027-03-21', minFixtures: 1 },
]

export function validateSampleWeekends(fixtures: FixtureArtefactRow[]): string[] {
  const errors: string[] = []

  for (const sample of SAMPLE_WEEKEND_CHECKS) {
    const weekendFixtures = fixtures.filter((f) => {
      const day = londonDateFromKickoff(f.kickoff_at)
      return day >= sample.sat && day <= sample.sun
    })

    if (weekendFixtures.length < sample.minFixtures) {
      errors.push(`${sample.label}: expected fixtures on ${sample.sat}–${sample.sun}, found ${weekendFixtures.length}`)
      continue
    }

    const hasEligible = weekendFixtures.some((f) => [6, 7].includes(londonDayOfWeek(f.kickoff_at)))
    if (!hasEligible) {
      errors.push(`${sample.label}: no Saturday/Sunday kickoffs in Europe/London`)
    }
  }

  return errors
}

export function validateFixtureArtefact(fixtures: FixtureArtefactRow[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const homeCounts: Record<string, number> = {}
  const awayCounts: Record<string, number> = {}
  const keyCounts = new Map<string, number>()

  for (const team of TEAM_CATALOG) {
    homeCounts[team.id] = 0
    awayCounts[team.id] = 0
  }

  if (fixtures.length !== 380) {
    errors.push(`Expected 380 fixtures, found ${fixtures.length}`)
  }

  for (const [index, fixture] of fixtures.entries()) {
    if (fixture.season !== SEASON) {
      errors.push(`Fixture ${index + 1}: season must be ${SEASON}`)
    }
    if (fixture.home_team_id === fixture.away_team_id) {
      errors.push(`Fixture ${index + 1}: self-fixture ${fixture.home_team_id}`)
    }
    if (!resolveTeamId(fixture.home_team_name) || !resolveTeamId(fixture.away_team_name)) {
      errors.push(`Fixture ${index + 1}: unmapped team name`)
    }
    if (!fixture.kickoff_at || Number.isNaN(Date.parse(fixture.kickoff_at))) {
      errors.push(`Fixture ${index + 1}: invalid kickoff_at`)
    }
    if (fixture.kickoff_london !== kickoffToLondonIso(fixture.kickoff_at)) {
      errors.push(`Fixture ${index + 1}: kickoff_london does not match kickoff_at`)
    }

    homeCounts[fixture.home_team_id] = (homeCounts[fixture.home_team_id] ?? 0) + 1
    awayCounts[fixture.away_team_id] = (awayCounts[fixture.away_team_id] ?? 0) + 1

    const key = fixture.canonical_key || canonicalKey(fixture.season, fixture.home_team_id, fixture.away_team_id, fixture.kickoff_at)
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1)
  }

  const teamsUsed = new Set(fixtures.flatMap((f) => [f.home_team_id, f.away_team_id]))
  if (teamsUsed.size !== 20) {
    errors.push(`Expected 20 teams, found ${teamsUsed.size}`)
  }

  for (const team of TEAM_CATALOG) {
    const home = homeCounts[team.id] ?? 0
    const away = awayCounts[team.id] ?? 0
    const total = home + away
    if (total !== 38) {
      errors.push(`${team.id}: expected 38 fixtures, found ${total}`)
    }
    if (home !== 19) {
      errors.push(`${team.id}: expected 19 home fixtures, found ${home}`)
    }
    if (away !== 19) {
      errors.push(`${team.id}: expected 19 away fixtures, found ${away}`)
    }
  }

  const duplicateKeys = [...keyCounts.entries()].filter(([, count]) => count > 1).map(([key]) => key)
  if (duplicateKeys.length > 0) {
    errors.push(`Duplicate canonical keys: ${duplicateKeys.slice(0, 5).join(', ')}${duplicateKeys.length > 5 ? '…' : ''}`)
  }

  errors.push(...validateSampleWeekends(fixtures))

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      fixtureCount: fixtures.length,
      teamCount: teamsUsed.size,
      homeCounts,
      awayCounts,
      duplicateKeys,
    },
  }
}
