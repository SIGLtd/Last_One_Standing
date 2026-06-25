import { londonDateFromKickoff } from '../../scripts/lib/fixtureValidation'
import type { SelectionWindowEligibleFixture, SelectionWindowWithMeta, SeasonFixture } from '../types'
import {
  WINDOW2_EARLIEST_KICKOFF_UTC,
  WINDOW2_NUMBER,
  WINDOW2_PLANNED_SAT,
  WINDOW2_PLANNED_SUN,
  WINDOW2_PROPOSED_DEADLINE_UTC,
  compareDraftSnapshotToMaster,
} from './window2Draft'
import { buildWindow2ReadinessPreview, resolveTeamName } from './window2Preview'
import { isOperationalWindowNumber } from './windowGuards'

function formatLondonDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

const EARLIEST_HOME_TEAM_ID = 'hul'
const EARLIEST_AWAY_TEAM_ID = 'mun'
const INVALID_FIXTURE_STATUSES = new Set(['postponed', 'cancelled', 'abandoned', 'suspended'])

export type Round1PublicationGateInput = {
  seasonFixtures: SeasonFixture[]
  snapshotFixtures: SelectionWindowEligibleFixture[]
  window: SelectionWindowWithMeta
  allWindows: SelectionWindowWithMeta[]
}

export type Round1PublicationGateResult = {
  passed: boolean
  discrepancies: string[]
  approvedFixtures: Array<{ label: string; kickoff_at: string }>
  deadlineUtc: string | null
  earliestKickoffUtc: string | null
}

export function validateRound1PublicationGate(input: Round1PublicationGateInput): Round1PublicationGateResult {
  const discrepancies: string[] = []
  const { seasonFixtures, snapshotFixtures, window, allWindows } = input

  const approvedFixtures = [...snapshotFixtures]
    .sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))
    .map((fixture) => ({
      label: `${fixture.home_team_name} v ${fixture.away_team_name}`,
      kickoff_at: fixture.kickoff_at,
    }))

  if (window.window_number !== WINDOW2_NUMBER) {
    discrepancies.push(`Expected operational window ${WINDOW2_NUMBER}, found window ${window.window_number}.`)
  }

  if (window.status !== 'pending') {
    discrepancies.push(`Window ${WINDOW2_NUMBER} must be pending before publication (current: ${window.status}).`)
  }

  const openOperational = allWindows.filter(
    (row) => isOperationalWindowNumber(row.window_number) && row.status === 'open',
  )
  if (openOperational.length > 0) {
    discrepancies.push(
      `An operational selection window is already open: ${openOperational
        .map((row) => `#${row.window_number} (${row.status})`)
        .join(', ')}.`,
    )
  }

  const preview = buildWindow2ReadinessPreview(seasonFixtures, allWindows.filter((row) => row.status === 'open'))
  if (preview.eligibleCount !== 8) {
    discrepancies.push(`Expected exactly 8 eligible fixtures in the official baseline, found ${preview.eligibleCount}.`)
  }

  if (preview.warnings.length > 0) {
    for (const warning of preview.warnings) {
      if (
        warning.includes('duplicate canonical') ||
        warning.includes('unmapped team') ||
        warning.includes('postponed or cancelled') ||
        warning.includes('Unexpected London calendar date')
      ) {
        discrepancies.push(warning)
      }
    }
  }

  const comparison = compareDraftSnapshotToMaster(snapshotFixtures, seasonFixtures)
  if (!comparison.matchesMaster) {
    discrepancies.push(...comparison.differences)
    if (comparison.snapshotFixtureCount !== 8) {
      discrepancies.push(`Snapshot contains ${comparison.snapshotFixtureCount} fixtures, expected 8.`)
    }
  }

  if (snapshotFixtures.length !== 8) {
    discrepancies.push(`Snapshot contains ${snapshotFixtures.length} fixtures, expected 8.`)
  }

  for (const fixture of snapshotFixtures) {
    const londonDate = londonDateFromKickoff(fixture.kickoff_at)
    if (londonDate !== WINDOW2_PLANNED_SAT && londonDate !== WINDOW2_PLANNED_SUN) {
      discrepancies.push(
        `Fixture ${fixture.home_team_name} v ${fixture.away_team_name} is on ${londonDate}, not the approved weekend.`,
      )
    }

    if (!resolveTeamName(fixture.home_team_id) || !resolveTeamName(fixture.away_team_id)) {
      discrepancies.push(`Unmapped team in snapshot fixture: ${fixture.home_team_name} v ${fixture.away_team_name}.`)
    }

    if (INVALID_FIXTURE_STATUSES.has(fixture.fixture_status)) {
      discrepancies.push(
        `Invalid snapshot fixture status (${fixture.fixture_status}): ${fixture.home_team_name} v ${fixture.away_team_name}.`,
      )
    }
  }

  const sortedSnapshot = [...snapshotFixtures].sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))
  const earliest = sortedSnapshot[0]
  if (!earliest) {
    discrepancies.push('No snapshot fixtures to evaluate earliest kick-off.')
  } else {
    if (earliest.home_team_id !== EARLIEST_HOME_TEAM_ID || earliest.away_team_id !== EARLIEST_AWAY_TEAM_ID) {
      discrepancies.push(
        `Earliest eligible fixture must be Hull City v Manchester United, found ${earliest.home_team_name} v ${earliest.away_team_name}.`,
      )
    }

    if (earliest.kickoff_at !== WINDOW2_EARLIEST_KICKOFF_UTC) {
      discrepancies.push(
        `Earliest kick-off must be 12:30 Europe/London on Saturday 22 August 2026 (${WINDOW2_EARLIEST_KICKOFF_UTC}), found ${formatLondonDateTime(earliest.kickoff_at)}.`,
      )
    }
  }

  if (window.deadline_at !== WINDOW2_PROPOSED_DEADLINE_UTC) {
    discrepancies.push(
      `Player deadline must be 11:30 Europe/London on Saturday 22 August 2026 (${WINDOW2_PROPOSED_DEADLINE_UTC}), found ${formatLondonDateTime(window.deadline_at)}.`,
    )
  }

  if (window.eligible_sat_date !== WINDOW2_PLANNED_SAT || window.eligible_sun_date !== WINDOW2_PLANNED_SUN) {
    discrepancies.push(
      `Eligible weekend must be ${WINDOW2_PLANNED_SAT} to ${WINDOW2_PLANNED_SUN}, found ${window.eligible_sat_date} to ${window.eligible_sun_date}.`,
    )
  }

  const canonicalKeys = snapshotFixtures.map((fixture) => `${fixture.home_team_id}|${fixture.away_team_id}|${fixture.kickoff_at}`)
  if (new Set(canonicalKeys).size !== canonicalKeys.length) {
    discrepancies.push('Duplicate canonical fixture keys detected in the approved snapshot.')
  }

  return {
    passed: discrepancies.length === 0,
    discrepancies,
    approvedFixtures,
    deadlineUtc: window.deadline_at,
    earliestKickoffUtc: window.earliest_kickoff_at,
  }
}
