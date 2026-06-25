import { londonDateFromKickoff, londonDayOfWeek } from '../../scripts/lib/fixtureValidation'
import { isStandardEligibleFixture } from '../../scripts/lib/weekendEligibility'
import { TEAM_CATALOG } from '../../scripts/lib/teamsCatalog'
import type { SeasonFixture, SelectionWindowWithMeta } from '../types'

export const WINDOW2_PREVIEW_SEASON = '2026/27'
export const WINDOW2_PREVIEW_SAT = '2026-08-22'
export const WINDOW2_PREVIEW_SUN = '2026-08-23'
export const WINDOW2_PREVIEW_TIMEZONE = 'Europe/London'

export type Window2PreviewFixture = SeasonFixture & {
  home_team_name: string
  away_team_name: string
}

export type Window2PreviewRow = {
  fixture: Window2PreviewFixture
  eligible: boolean
  reason: string
}

export type Window2ReadinessPreview = {
  season: string
  targetSatDate: string
  targetSunDate: string
  timezone: typeof WINDOW2_PREVIEW_TIMEZONE
  reviewed: Window2PreviewRow[]
  eligible: Window2PreviewRow[]
  excluded: Window2PreviewRow[]
  warnings: string[]
  eligibleCount: number
  earliestEligibleKickoff: string | null
  proposedDeadline: string | null
  existingOperationalWindows: Array<{ window_number: number; status: string }>
  previewOnly: true
}

const teamNameById = new Map(TEAM_CATALOG.map((team) => [team.id, team.name]))

export function resolveTeamName(teamId: string): string | null {
  return teamNameById.get(teamId) ?? null
}

export function findDuplicateCanonicalKeys(fixtures: SeasonFixture[]): Set<string> {
  const counts = new Map<string, number>()
  for (const fixture of fixtures) {
    counts.set(fixture.canonical_key, (counts.get(fixture.canonical_key) ?? 0) + 1)
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key))
}

export function isUsableKickoff(kickoffAt: string): boolean {
  if (!kickoffAt) return false
  const parsed = Date.parse(kickoffAt)
  return Number.isFinite(parsed)
}

export type Window2EligibilityContext = {
  targetSat: string
  targetSun: string
  duplicateKeys: Set<string>
}

export function evaluateWindow2FixtureEligibility(
  fixture: Window2PreviewFixture,
  context: Window2EligibilityContext,
): { eligible: boolean; reason: string } {
  const londonDate = londonDateFromKickoff(fixture.kickoff_at)

  if (londonDate < context.targetSat || londonDate > context.targetSun) {
    return { eligible: false, reason: `Outside target weekend (${context.targetSat}–${context.targetSun})` }
  }

  if (!isUsableKickoff(fixture.kickoff_at)) {
    return { eligible: false, reason: 'Missing or invalid kick-off time' }
  }

  if (!resolveTeamName(fixture.home_team_id)) {
    return { eligible: false, reason: `Unknown home team mapping (${fixture.home_team_id})` }
  }

  if (!resolveTeamName(fixture.away_team_id)) {
    return { eligible: false, reason: `Unknown away team mapping (${fixture.away_team_id})` }
  }

  if (context.duplicateKeys.has(fixture.canonical_key)) {
    return { eligible: false, reason: 'Duplicate canonical fixture key' }
  }

  if (fixture.status === 'postponed') {
    return { eligible: false, reason: 'Postponed' }
  }

  if (fixture.status === 'cancelled') {
    return { eligible: false, reason: 'Cancelled' }
  }

  if (fixture.status === 'finished') {
    return { eligible: false, reason: 'Already finished' }
  }

  if (fixture.eligibility_override === 'force_ineligible') {
    return { eligible: false, reason: 'Marked force ineligible by organiser override' }
  }

  const londonDow = londonDayOfWeek(fixture.kickoff_at)
  if (![6, 7].includes(londonDow)) {
    const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    return {
      eligible: false,
      reason: `Not a Saturday/Sunday kick-off in ${WINDOW2_PREVIEW_TIMEZONE} (${dayNames[londonDow] ?? 'unknown'})`,
    }
  }

  if (
    !isStandardEligibleFixture(
      fixture.kickoff_at,
      fixture.eligibility_override ?? 'none',
      fixture.status,
      londonDayOfWeek,
    )
  ) {
    return { eligible: false, reason: `Status not eligible for player selection (${fixture.status})` }
  }

  return { eligible: true, reason: 'Eligible for Window 2 candidate set' }
}

export function calculateProposedDeadline(earliestEligibleKickoff: string | null): string | null {
  if (!earliestEligibleKickoff) return null
  return new Date(Date.parse(earliestEligibleKickoff) - 60 * 60 * 1000).toISOString()
}

export function attachTeamNames(fixture: SeasonFixture): Window2PreviewFixture {
  return {
    ...fixture,
    home_team_name: resolveTeamName(fixture.home_team_id) ?? fixture.home_team_id,
    away_team_name: resolveTeamName(fixture.away_team_id) ?? fixture.away_team_id,
  }
}

export function buildWindow2ReadinessPreview(
  fixtures: SeasonFixture[],
  selectionWindows: SelectionWindowWithMeta[],
): Window2ReadinessPreview {
  const seasonFixtures = fixtures.filter((fixture) => fixture.season === WINDOW2_PREVIEW_SEASON)
  const duplicateKeys = findDuplicateCanonicalKeys(seasonFixtures)
  const context: Window2EligibilityContext = {
    targetSat: WINDOW2_PREVIEW_SAT,
    targetSun: WINDOW2_PREVIEW_SUN,
    duplicateKeys,
  }

  const reviewedFixtures = seasonFixtures.filter((fixture) => {
    const day = londonDateFromKickoff(fixture.kickoff_at)
    return day >= WINDOW2_PREVIEW_SAT && day <= WINDOW2_PREVIEW_SUN
  })

  const reviewed: Window2PreviewRow[] = reviewedFixtures
    .map((fixture) => attachTeamNames(fixture))
    .map((fixture) => {
      const result = evaluateWindow2FixtureEligibility(fixture, context)
      return { fixture, ...result }
    })
    .sort((a, b) => a.fixture.kickoff_at.localeCompare(b.fixture.kickoff_at))

  const eligible = reviewed.filter((row) => row.eligible)
  const excluded = reviewed.filter((row) => !row.eligible)

  const warnings: string[] = []

  if (reviewed.length === 0) {
    warnings.push('No fixtures found on the target London weekend dates.')
  }

  if (eligible.length === 0) {
    warnings.push('No eligible fixtures for Window 2 on this weekend.')
  }

  if (duplicateKeys.size > 0) {
    warnings.push(`${duplicateKeys.size} duplicate canonical fixture key(s) detected in the season master list.`)
  }

  if (excluded.some((row) => row.reason.includes('Unknown'))) {
    warnings.push('One or more fixtures have unmapped team identifiers.')
  }

  if (excluded.some((row) => row.reason === 'Postponed' || row.reason === 'Cancelled')) {
    warnings.push('One or more weekend fixtures are postponed or cancelled.')
  }

  const adjacentFridayFixtures = seasonFixtures.filter((fixture) => {
    const day = londonDateFromKickoff(fixture.kickoff_at)
    const fridayBefore = '2026-08-21'
    return day === fridayBefore
  })
  if (adjacentFridayFixtures.length > 0) {
    warnings.push(
      `${adjacentFridayFixtures.length} fixture(s) kick off on Friday 21 Aug 2026 and are outside this Window 2 weekend.`,
    )
  }

  const londonDatesFound = new Set(reviewed.map((row) => londonDateFromKickoff(row.fixture.kickoff_at)))
  const expectedDates = new Set([WINDOW2_PREVIEW_SAT, WINDOW2_PREVIEW_SUN])
  for (const date of londonDatesFound) {
    if (!expectedDates.has(date)) {
      warnings.push(`Unexpected London calendar date in weekend review: ${date}`)
    }
  }

  const existingOperationalWindows = selectionWindows
    .filter((window) => window.window_number >= 2)
    .map((window) => ({ window_number: window.window_number, status: window.status }))

  if (existingOperationalWindows.length > 0) {
    warnings.push(
      `Operational window record(s) already exist: ${existingOperationalWindows
        .map((window) => `#${window.window_number} (${window.status})`)
        .join(', ')}`,
    )
  }

  const earliestEligibleKickoff =
    eligible.length > 0
      ? eligible.reduce(
          (min, row) => (row.fixture.kickoff_at < min ? row.fixture.kickoff_at : min),
          eligible[0].fixture.kickoff_at,
        )
      : null

  return {
    season: WINDOW2_PREVIEW_SEASON,
    targetSatDate: WINDOW2_PREVIEW_SAT,
    targetSunDate: WINDOW2_PREVIEW_SUN,
    timezone: WINDOW2_PREVIEW_TIMEZONE,
    reviewed,
    eligible,
    excluded,
    warnings,
    eligibleCount: eligible.length,
    earliestEligibleKickoff,
    proposedDeadline: calculateProposedDeadline(earliestEligibleKickoff),
    existingOperationalWindows,
    previewOnly: true,
  }
}
