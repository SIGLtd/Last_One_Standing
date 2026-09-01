import { londonDateFromKickoff, londonDayOfWeek } from '../../scripts/lib/fixtureValidation'
import { isStandardEligibleFixture } from '../../scripts/lib/weekendEligibility'
import {
  INVALID_WEEKDAY_SNAPSHOT_WARNING,
  hasReliableKickoff,
  isLosRoundEligibleFixture,
} from './weekendFixtures'

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
  canonical_key?: string | null
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
  if (!hasReliableKickoff(kickoffAt)) return 'Unknown'
  return DAY_LABEL[londonDayOfWeek(kickoffAt)] ?? 'Unknown'
}

export function selectEligibleWeekendFixtures<T extends WeekendSnapshotFixture>(
  fixtures: T[],
  sat: string,
  sun: string,
): T[] {
  return fixtures.filter((fixture) => {
    if (!hasReliableKickoff(fixture.kickoff_at)) return false
    const day = londonDateFromKickoff(fixture.kickoff_at)
    if (day < sat || day > sun) return false
    if (
      !isLosRoundEligibleFixture({
        kickoff_at: fixture.kickoff_at,
        eligibility_override: fixture.eligibility_override ?? 'none',
        canonical_key: fixture.canonical_key,
      })
    ) {
      return false
    }
    return isStandardEligibleFixture(
      fixture.kickoff_at,
      fixture.eligibility_override ?? 'none',
      fixture.status ?? 'scheduled',
      londonDayOfWeek,
    )
  })
}

export function inspectWeekendSnapshot(
  fixtures: Array<
    Pick<
      WeekendSnapshotFixture,
      'season_fixture_id' | 'home_team_id' | 'away_team_id' | 'kickoff_at' | 'eligibility_override' | 'canonical_key'
    >
  >,
): WeekendSnapshotValidity {
  const issues: string[] = []
  const nonWeekend: SnapshotFixtureIssue[] = []
  let saturdayCount = 0
  let sundayCount = 0
  const dates = fixtures
    .filter((fixture) => hasReliableKickoff(fixture.kickoff_at))
    .map((fixture) => londonDateFromKickoff(fixture.kickoff_at))
    .sort()

  for (const fixture of fixtures) {
    const dow = hasReliableKickoff(fixture.kickoff_at) ? londonDayOfWeek(fixture.kickoff_at) : 0
    const londonDate = hasReliableKickoff(fixture.kickoff_at) ? londonDateFromKickoff(fixture.kickoff_at) : 'unknown'
    const londonDay = londonWeekdayLabel(fixture.kickoff_at)
    if (dow === 6) saturdayCount += 1
    if (dow === 7) sundayCount += 1
    const override = fixture.eligibility_override ?? 'none'
    if (override === 'force_eligible' && hasReliableKickoff(fixture.kickoff_at)) continue
    const eligible = isLosRoundEligibleFixture({
      kickoff_at: fixture.kickoff_at,
      eligibility_override: override,
      canonical_key: fixture.canonical_key,
    })
    if (!eligible) {
      nonWeekend.push({
        season_fixture_id: fixture.season_fixture_id,
        home_team_id: fixture.home_team_id,
        away_team_id: fixture.away_team_id,
        kickoff_at: fixture.kickoff_at,
        londonDate,
        londonDay: hasReliableKickoff(fixture.kickoff_at) ? londonDay : 'Unknown',
        reason: hasReliableKickoff(fixture.kickoff_at)
          ? `${londonDay} fixtures are excluded unless Admin makes an explicit exception.`
          : 'Fixture has no reliable kickoff timestamp and cannot be included by default.',
      })
    }
  }

  if (fixtures.length < 1) {
    issues.push('This round has no eligible fixtures.')
  }
  if (nonWeekend.length > 0) {
    issues.push(INVALID_WEEKDAY_SNAPSHOT_WARNING)
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

export function planStripInvalidSnapshotFixtures<T extends WeekendSnapshotFixture>(input: {
  windowStatus: string
  currentSnapshot: T[]
  picks: Array<{ team_id?: string | null; season_fixture_id?: string | null }>
}): {
  action: 'noop' | 'strip' | 'blocked'
  reason: string | null
  nextSnapshot: T[]
  removed: T[]
  preserveDeadline: true
} {
  const removed = input.currentSnapshot.filter(
    (fixture) =>
      !isLosRoundEligibleFixture({
        kickoff_at: fixture.kickoff_at,
        eligibility_override: fixture.eligibility_override ?? 'none',
        canonical_key: fixture.canonical_key,
      }),
  )
  const kept = input.currentSnapshot.filter((fixture) => !removed.includes(fixture))
  if (removed.length === 0) {
    return { action: 'noop', reason: null, nextSnapshot: input.currentSnapshot.map((row) => ({ ...row })), removed: [], preserveDeadline: true }
  }
  if (input.windowStatus !== 'open' && input.windowStatus !== 'pending') {
    return {
      action: 'blocked',
      reason: 'Only an open or pending future round can have invalid fixtures removed.',
      nextSnapshot: input.currentSnapshot.map((row) => ({ ...row })),
      removed,
      preserveDeadline: true,
    }
  }
  const invalidTeams = new Set(removed.flatMap((fixture) => [fixture.home_team_id, fixture.away_team_id]))
  const invalidIds = new Set(removed.map((fixture) => fixture.season_fixture_id))
  const picksOnInvalid = input.picks.filter((pick) => {
    if (!pick.team_id) return false
    if (pick.season_fixture_id && invalidIds.has(pick.season_fixture_id)) return true
    return invalidTeams.has(pick.team_id)
  })
  if (picksOnInvalid.length > 0) {
    return {
      action: 'blocked',
      reason: 'This round already has picks on the invalid Friday/Monday fixture. The snapshot cannot be stripped without an explicit pick-handling plan.',
      nextSnapshot: input.currentSnapshot.map((row) => ({ ...row })),
      removed,
      preserveDeadline: true,
    }
  }
  return { action: 'strip', reason: null, nextSnapshot: kept, removed, preserveDeadline: true }
}

function snapshotIdentity(fixtures: WeekendSnapshotFixture[]): string {
  return fixtures
    .map((fixture) => `${fixture.season_fixture_id}|${fixture.kickoff_at}`)
    .sort()
    .join(';')
}
