import { londonDateFromKickoff, londonDayOfWeek } from '../../scripts/lib/fixtureValidation'
import type { SeasonFixture, SelectionWindowWithMeta } from '../types'
import { MIN_OPERATIONAL_WINDOW_NUMBER } from './windowGuards'
import { inspectWeekendSnapshot, selectEligibleWeekendFixtures } from './weekendSnapshot'

export type NextRoundWeekend = {
  sat: string
  sun: string
  eligible: SeasonFixture[]
  fridayExcluded: number
  mondayExcluded: number
  earliestKickoffAt: string | null
  proposedDeadline: string | null
}

export function proposedDeadlineFromEarliestKickoff(earliestKickoffAt: string | null): string | null {
  if (!earliestKickoffAt) return null
  return new Date(Date.parse(earliestKickoffAt) - 60 * 60 * 1000).toISOString()
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function findNextPremierLeagueWeekend(
  fixtures: SeasonFixture[],
  afterLondonDate: string,
): NextRoundWeekend | null {
  const later = fixtures
    .filter((fixture) => londonDateFromKickoff(fixture.kickoff_at) > afterLondonDate)
    .sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))

  const seenSaturdays = new Set<string>()

  for (const fixture of later) {
    const day = londonDateFromKickoff(fixture.kickoff_at)
    const dow = londonDayOfWeek(fixture.kickoff_at)
    const sat = dow === 6 ? day : dow === 7 ? addDays(day, -1) : null
    if (!sat || seenSaturdays.has(sat)) continue
    seenSaturdays.add(sat)
    const sun = addDays(sat, 1)

    const weekendFixtures = later.filter((row) => {
      const londonDay = londonDateFromKickoff(row.kickoff_at)
      return londonDay >= sat && londonDay <= sun
    })

    const eligible = selectEligibleWeekendFixtures(
      weekendFixtures.map((row) => ({
        season_fixture_id: row.id,
        home_team_id: row.home_team_id,
        away_team_id: row.away_team_id,
        kickoff_at: row.kickoff_at,
        eligibility_override: row.eligibility_override,
        status: row.status,
        canonical_key: row.canonical_key,
      })),
      sat,
      sun,
    ).map((row) => weekendFixtures.find((fixture) => fixture.id === row.season_fixture_id)!)

    const fridayExcluded = later.filter((row) => londonDateFromKickoff(row.kickoff_at) === addDays(sat, -1)).length
    const mondayExcluded = later.filter((row) => londonDateFromKickoff(row.kickoff_at) === addDays(sun, 1)).length

    if (eligible.length === 0) continue

    const earliestKickoffAt = eligible.reduce(
      (min, row) => (row.kickoff_at < min ? row.kickoff_at : min),
      eligible[0].kickoff_at,
    )

    return {
      sat,
      sun,
      eligible,
      fridayExcluded,
      mondayExcluded,
      earliestKickoffAt,
      proposedDeadline: proposedDeadlineFromEarliestKickoff(earliestKickoffAt),
    }
  }

  return null
}

export type OpenNextRoundCheck = {
  canOpen: boolean
  reason: string | null
  survivorCount: number
  alreadyOpen: boolean
  weekend: NextRoundWeekend | null
}

export function canOpenNextRound(input: {
  currentWindow: Pick<SelectionWindowWithMeta, 'status' | 'window_number' | 'eligible_sun_date' | 'eligible_sat_date'>
  windows: Array<Pick<SelectionWindowWithMeta, 'status' | 'window_number' | 'eligible_sat_date' | 'eligible_sun_date'>>
  fixtures: SeasonFixture[]
  survivorCount: number
  gameStatus?: string
}): OpenNextRoundCheck {
  if (input.gameStatus === 'complete' || input.gameStatus === 'rolled_over' || input.gameStatus === 'off_season') {
    return {
      canOpen: false,
      reason: 'This game is complete. Start a new game instead of opening another round.',
      survivorCount: input.survivorCount,
      alreadyOpen: false,
      weekend: null,
    }
  }

  if (input.survivorCount === 1) {
    return {
      canOpen: false,
      reason: 'This game has a winner. Complete the game before starting a new one.',
      survivorCount: 1,
      alreadyOpen: false,
      weekend: null,
    }
  }

  if (input.currentWindow.window_number < MIN_OPERATIONAL_WINDOW_NUMBER) {
    return { canOpen: false, reason: 'Historic Window 1 cannot open the next round.', survivorCount: 0, alreadyOpen: false, weekend: null }
  }

  if (input.currentWindow.status !== 'resolved') {
    return {
      canOpen: false,
      reason: 'Resolve the current round before opening the next one.',
      survivorCount: input.survivorCount,
      alreadyOpen: false,
      weekend: null,
    }
  }

  const laterOpen = input.windows.some(
    (window) =>
      window.window_number > input.currentWindow.window_number &&
      window.window_number >= MIN_OPERATIONAL_WINDOW_NUMBER &&
      (window.status === 'open' || window.status === 'locked' || window.status === 'resolving'),
  )

  if (laterOpen) {
    return {
      canOpen: false,
      reason: 'The next round is already open.',
      survivorCount: input.survivorCount,
      alreadyOpen: true,
      weekend: null,
    }
  }

  if (input.survivorCount < 1) {
    return {
      canOpen: false,
      reason: 'No survivors remain. Rollover is not automatic.',
      survivorCount: 0,
      alreadyOpen: false,
      weekend: null,
    }
  }

  const afterDate = input.currentWindow.eligible_sun_date ?? input.currentWindow.eligible_sat_date
  if (!afterDate) {
    return {
      canOpen: false,
      reason: 'Current round weekend dates are missing.',
      survivorCount: input.survivorCount,
      alreadyOpen: false,
      weekend: null,
    }
  }

  const weekend = findNextPremierLeagueWeekend(input.fixtures, afterDate)
  if (!weekend) {
    return {
      canOpen: false,
      reason: 'No eligible Saturday/Sunday Premier League weekend was found.',
      survivorCount: input.survivorCount,
      alreadyOpen: false,
      weekend: null,
    }
  }

  const validity = inspectWeekendSnapshot(
    weekend.eligible.map((fixture) => ({
      season_fixture_id: fixture.id,
      home_team_id: fixture.home_team_id,
      away_team_id: fixture.away_team_id,
      kickoff_at: fixture.kickoff_at,
      eligibility_override: fixture.eligibility_override,
      canonical_key: fixture.canonical_key,
    })),
  )
  if (!validity.valid) {
    return {
      canOpen: false,
      reason: validity.issues[0] ?? 'Next-round fixtures include a non-Saturday/Sunday match without an explicit exception.',
      survivorCount: input.survivorCount,
      alreadyOpen: false,
      weekend,
    }
  }

  const duplicateWeekend = input.windows.some(
    (window) =>
      window.window_number >= MIN_OPERATIONAL_WINDOW_NUMBER &&
      window.eligible_sat_date === weekend.sat &&
      window.eligible_sun_date === weekend.sun &&
      (window.status === 'open' || window.status === 'pending' || window.status === 'locked' || window.status === 'resolving'),
  )

  if (duplicateWeekend) {
    return {
      canOpen: false,
      reason: 'A selection window already exists for that weekend.',
      survivorCount: input.survivorCount,
      alreadyOpen: true,
      weekend,
    }
  }

  return {
    canOpen: true,
    reason: null,
    survivorCount: input.survivorCount,
    alreadyOpen: false,
    weekend,
  }
}
