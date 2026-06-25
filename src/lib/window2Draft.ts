import type { SelectionWindowEligibleFixture, SeasonFixture } from '../types'
import {
  WINDOW2_PREVIEW_SAT,
  WINDOW2_PREVIEW_SUN,
  buildWindow2ReadinessPreview,
} from './window2Preview'
import { isOperationalWindowNumber, isPlayerFacingOpenWindow, isProtectedHistoricWindow } from './windowGuards'

export const WINDOW2_NUMBER = 2
export const WINDOW2_PLANNED_SAT = WINDOW2_PREVIEW_SAT
export const WINDOW2_PLANNED_SUN = WINDOW2_PREVIEW_SUN
export const WINDOW2_EARLIEST_KICKOFF_UTC = '2026-08-22T11:30:00.000Z'
export const WINDOW2_PROPOSED_DEADLINE_UTC = '2026-08-22T10:30:00.000Z'
export const WINDOW2_PLANNED_WEEKEND_LABEL = '22–23 August 2026'
export const WINDOW2_DRAFT_ORGANISER_NOTE =
  'Draft only. Fixture snapshot will be revalidated before publication.'

export { PLAYER_ROUND1_OPEN_MESSAGE as WINDOW2_UPCOMING_PLAYER_MESSAGE } from './round1'

export type DraftSnapshotComparison = {
  matchesMaster: boolean
  masterEligibleCount: number
  snapshotFixtureCount: number
  differences: string[]
}

export function isDraftOperationalWindow(window: { window_number: number; status: string }): boolean {
  return isOperationalWindowNumber(window.window_number) && window.status === 'pending'
}

export function shouldShowPlayerPickForm(window: { window_number: number; status: string } | null): boolean {
  if (!window) return false
  return isPlayerFacingOpenWindow({ ...window, snapshot_fixture_count: 1, deadline_at: '' })
}

export function snapshotRowKey(fixture: {
  home_team_id: string
  away_team_id: string
  kickoff_at: string
}): string {
  return `${fixture.home_team_id}|${fixture.away_team_id}|${fixture.kickoff_at}`
}

export function compareDraftSnapshotToMaster(
  snapshot: SelectionWindowEligibleFixture[],
  seasonFixtures: SeasonFixture[],
): DraftSnapshotComparison {
  const masterPreview = buildWindow2ReadinessPreview(seasonFixtures, [])
  const masterEligible = masterPreview.eligible.map((row) => row.fixture)

  const masterKeys = new Set(masterEligible.map((fixture) => snapshotRowKey(fixture)))
  const snapshotKeys = new Set(snapshot.map((fixture) => snapshotRowKey(fixture)))

  const differences: string[] = []

  for (const fixture of masterEligible) {
    const key = snapshotRowKey(fixture)
    if (!snapshotKeys.has(key)) {
      differences.push(`Missing from draft snapshot: ${fixture.home_team_id} v ${fixture.away_team_id}`)
    }
  }

  for (const fixture of snapshot) {
    const key = snapshotRowKey(fixture)
    if (!masterKeys.has(key)) {
      differences.push(`Extra in draft snapshot: ${fixture.home_team_name} v ${fixture.away_team_name}`)
    }
  }

  for (const fixture of snapshot) {
    const master = masterEligible.find((row) => snapshotRowKey(row) === snapshotRowKey(fixture))
    if (master && master.kickoff_at !== fixture.kickoff_at) {
      differences.push(`Kick-off mismatch: ${fixture.home_team_name} v ${fixture.away_team_name}`)
    }
  }

  return {
    matchesMaster: differences.length === 0 && snapshot.length === masterEligible.length,
    masterEligibleCount: masterEligible.length,
    snapshotFixtureCount: snapshot.length,
    differences,
  }
}

export function window2DraftSummary(window: {
  window_number: number
  status: string
  eligible_sat_date: string | null
  eligible_sun_date: string | null
  deadline_at: string
  earliest_kickoff_at: string | null
}) {
  return {
    isWindow2Draft: window.window_number === WINDOW2_NUMBER && isDraftOperationalWindow(window),
    isProtectedWindow1Untouched: isProtectedHistoricWindow(1),
    playerSelectionsPermitted: shouldShowPlayerPickForm(window),
  }
}
