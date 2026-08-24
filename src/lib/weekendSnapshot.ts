import { londonDateFromKickoff, londonDayOfWeek } from '../../scripts/lib/fixtureValidation'
import { isStandardEligibleFixture } from '../../scripts/lib/weekendEligibility'
import { isUkWeekendKickoff } from './weekendFixtures'

const DAY_LABEL = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

export type WeekendSnapshotFixture = {
  season_fixture_id: string
  home_team_id: string
  away_team_id: string
  home_team_name?: string
  away_team_name?: string
  kickoff_at: string
  eligibility_override?: string | null
  status?: string
}

export type SnapshotFixtureIssue = {
  season_fixture_id: string
  home_team_id: string
  away_team_id: string
  kickoff_at: string
  londonDate: string
  londonDay: string
  reason: string
}

export type WeekendSnapshotValidity = {
  valid: boolean
  fixtureCount: number
  saturdayCount: number
  sundayCount: number
  weekendLabel: string | null
  issues: string[]
  nonWeekend: SnapshotFixtureIssue[]
}

export function londonWeekdayLabel(kickoffAt: string): string {
  return DAY_LABEL[londonDayOfWeek(kickoffAt)] ?? 'Unknown'
}

export function selectEligibleWeekendFixtures<T extends WeekendSnapshotFixture>(
  fixtures: T[],
  sat: string,
  sun: string,
): T[] {
  return fixtures.filter((fixture) => {
    const day = londonDateFromKickoff(fixture.kickoff_at)
    if (day < sat || day > sun) return false
    return isStandardEligibleFixture(
      fixture.kickoff_at,
      fixture.eligibility_override ?? 'none',
      fixture.status ?? 'scheduled',
      londonDayOfWeek,
    )
  })
}

export function inspectWeekendSnapshot(
  fixtures: Array<Pick<WeekendSnapshotFixture, 'season_fixture_id' | 'home_team_id' | 'away_team_id' | 'kickoff_at' | 'eligibility_override'>>,
): WeekendSnapshotValidity {
  const issues: string[] = []
  const nonWeekend: SnapshotFixtureIssue[] = []
  let saturdayCount = 0
  let sundayCount = 0
  const dates = fixtures.map((fixture) => londonDateFromKickoff(fixture.kickoff_at)).sort()

  for (const fixture of fixtures) {
    const dow = londonDayOfWeek(fixture.kickoff_at)
    const londonDate = londonDateFromKickoff(fixture.kickoff_at)
    const londonDay = londonWeekdayLabel(fixture.kickoff_at)
    if (dow === 6) saturdayCount += 1
    if (dow === 7) sundayCount += 1
    const override = fixture.eligibility_override ?? 'none'
    if (override === 'force_eligible') continue
    if (!isUkWeekendKickoff(fixture.kickoff_at)) {
      nonWeekend.push({
        season_fixture_id: fixture.season_fixture_id,
        home_team_id: fixture.home_team_id,
        away_team_id: fixture.away_team_id,
        kickoff_at: fixture.kickoff_at,
        londonDate,
        londonDay,
        reason: `${londonDay} fixtures are excluded unless Admin makes an explicit exception.`,
      })
    }
  }

  if (fixtures.length < 1) {
    issues.push('This round has no eligible fixtures.')
  }
  if (nonWeekend.length > 0) {
    issues.push(
      `This round includes ${nonWeekend.length} Friday/Monday/midweek fixture${nonWeekend.length === 1 ? '' : 's'} without an explicit exception.`,
    )
  }

  return {
    valid: issues.length === 0,
    fixtureCount: fixtures.length,
    saturdayCount,
    sundayCount,
    weekendLabel: dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : null,
    issues,
    nonWeekend,
  }
}

export function canCorrectOpenWindowSnapshot(input: {
  windowStatus: string
  pickCount: number
}): { ok: boolean; reason: string | null } {
  if (input.windowStatus !== 'open' && input.windowStatus !== 'pending') {
    return { ok: false, reason: 'Only an open or pending future round can have its fixture snapshot corrected.' }
  }
  if (input.pickCount > 0) {
    return {
      ok: false,
      reason: 'This round already has picks. The fixture snapshot cannot be replaced without an explicit pick-handling plan.',
    }
  }
  return { ok: true, reason: null }
}

export function planOpenWindowSnapshotCorrection<T extends WeekendSnapshotFixture>(input: {
  windowStatus: string
  pickCount: number
  sat: string
  sun: string
  currentSnapshot: T[]
  masterFixtures: T[]
}): {
  action: 'noop' | 'replace' | 'blocked'
  reason: string | null
  nextSnapshot: T[]
} {
  const gate = canCorrectOpenWindowSnapshot({ windowStatus: input.windowStatus, pickCount: input.pickCount })
  if (!gate.ok) {
    return { action: 'blocked', reason: gate.reason, nextSnapshot: input.currentSnapshot.map((row) => ({ ...row })) }
  }

  const nextSnapshot = selectEligibleWeekendFixtures(input.masterFixtures, input.sat, input.sun)
  const validity = inspectWeekendSnapshot(nextSnapshot)
  if (!validity.valid) {
    return {
      action: 'blocked',
      reason: validity.issues[0] ?? 'Corrected snapshot would still include non-Saturday/Sunday fixtures.',
      nextSnapshot: input.currentSnapshot.map((row) => ({ ...row })),
    }
  }

  const currentKey = snapshotIdentity(input.currentSnapshot)
  const nextKey = snapshotIdentity(nextSnapshot)
  if (currentKey === nextKey) {
    return { action: 'noop', reason: null, nextSnapshot }
  }

  return { action: 'replace', reason: null, nextSnapshot }
}

function snapshotIdentity(fixtures: WeekendSnapshotFixture[]): string {
  return fixtures
    .map((fixture) => `${fixture.season_fixture_id}|${fixture.kickoff_at}`)
    .sort()
    .join(';')
}
