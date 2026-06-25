import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { SeasonFixture, SelectionWindowEligibleFixture, SelectionWindowWithMeta } from '../types'
import { validateRound1PublicationGate } from './round1Publication'
import { buildWindow2ReadinessPreview } from './window2Preview'
import { WINDOW2_EARLIEST_KICKOFF_UTC, WINDOW2_PROPOSED_DEADLINE_UTC } from './window2Draft'
import { shouldShowPlayerPickForm } from './window2Draft'
import { isPlayerFacingOpenWindow, isProtectedHistoricWindow } from './windowGuards'

const __dirname = dirname(fileURLToPath(import.meta.url))
const artefactPath = join(__dirname, '..', '..', 'data', 'fixtures', '2026-27', 'fixtures.json')

function loadArtefactSeasonFixtures(): SeasonFixture[] {
  const artefact = JSON.parse(readFileSync(artefactPath, 'utf8')) as {
    fixtures: Array<{
      canonical_key: string
      season: string
      home_team_id: string
      away_team_id: string
      kickoff_at: string
      original_kickoff_at: string
      source_fixture_id: string | null
    }>
  }

  return artefact.fixtures.map((row) => ({
    id: `id-${row.canonical_key}`,
    season: row.season,
    source_fixture_id: row.source_fixture_id,
    canonical_key: row.canonical_key,
    home_team_id: row.home_team_id,
    away_team_id: row.away_team_id,
    kickoff_at: row.kickoff_at,
    original_kickoff_at: row.original_kickoff_at,
    status: 'scheduled' as const,
    home_score: null,
    away_score: null,
    result_status: 'pending',
    source_name: 'premier_league_official',
    source_url: null,
    source_retrieved_at: null,
    eligibility_override: 'none' as const,
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
  }))
}

function snapshotFromMaster(): SelectionWindowEligibleFixture[] {
  const preview = buildWindow2ReadinessPreview(loadArtefactSeasonFixtures(), [])
  return preview.eligible.map((row, index) => ({
    id: `snap-${index}`,
    window_id: 'draft-window',
    season_fixture_id: row.fixture.id,
    home_team_id: row.fixture.home_team_id,
    away_team_id: row.fixture.away_team_id,
    home_team_name: row.fixture.home_team_name,
    away_team_name: row.fixture.away_team_name,
    kickoff_at: row.fixture.kickoff_at,
    snapshot_kickoff_at: row.fixture.kickoff_at,
    fixture_status: 'scheduled',
    created_at: '2026-06-23T00:00:00.000Z',
  }))
}

const pendingWindow2: SelectionWindowWithMeta = {
  id: 'w2',
  game_id: 'g1',
  window_number: 2,
  status: 'pending',
  start_at: '2026-08-20T11:30:00.000Z',
  end_at: '2026-08-24T11:30:00.000Z',
  deadline_at: WINDOW2_PROPOSED_DEADLINE_UTC,
  eligible_sat_date: '2026-08-22',
  eligible_sun_date: '2026-08-23',
  review_outcome: null,
  sync_run_id: null,
  earliest_kickoff_at: WINDOW2_EARLIEST_KICKOFF_UTC,
  approved_at: null,
  approved_by_player_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

describe('round 1 publication gate', () => {
  it('refuses publication when the approved candidate does not match', () => {
    const result = validateRound1PublicationGate({
      seasonFixtures: loadArtefactSeasonFixtures(),
      snapshotFixtures: snapshotFromMaster().slice(0, 7),
      window: pendingWindow2,
      allWindows: [{ window_number: 1, status: 'open' } as SelectionWindowWithMeta, pendingWindow2],
    })

    expect(result.passed).toBe(false)
    expect(result.discrepancies.length).toBeGreaterThan(0)
  })

  it('approves the successful candidate with exactly 8 fixtures and Hull City v Manchester United first', () => {
    const snapshot = snapshotFromMaster()
    const result = validateRound1PublicationGate({
      seasonFixtures: loadArtefactSeasonFixtures(),
      snapshotFixtures: snapshot,
      window: pendingWindow2,
      allWindows: [{ window_number: 1, status: 'open' } as SelectionWindowWithMeta, pendingWindow2],
    })

    expect(result.passed).toBe(true)
    expect(result.discrepancies).toEqual([])
    expect(result.approvedFixtures).toHaveLength(8)
    expect(result.approvedFixtures[0]?.label).toBe('Hull City v Manchester United')
    expect(result.deadlineUtc).toBe(WINDOW2_PROPOSED_DEADLINE_UTC)
  })

  it('permits paid active players to use the pick flow once Round 1 is open', () => {
    const openWindow = { ...pendingWindow2, status: 'open' as const, approved_at: '2026-06-23T12:00:00.000Z' }
    expect(shouldShowPlayerPickForm(openWindow)).toBe(true)
    expect(
      isPlayerFacingOpenWindow({
        window_number: 2,
        status: 'open',
        deadline_at: WINDOW2_PROPOSED_DEADLINE_UTC,
        snapshot_fixture_count: 8,
      }),
    ).toBe(true)
  })

  it('keeps Window 1 protected and unchanged', () => {
    expect(isProtectedHistoricWindow(1)).toBe(true)
    const result = validateRound1PublicationGate({
      seasonFixtures: loadArtefactSeasonFixtures(),
      snapshotFixtures: snapshotFromMaster(),
      window: pendingWindow2,
      allWindows: [{ window_number: 1, status: 'open' } as SelectionWindowWithMeta, pendingWindow2],
    })
    expect(result.passed).toBe(true)
  })

  it('does not consume teams from a pending draft window', () => {
    expect(shouldShowPlayerPickForm(pendingWindow2)).toBe(false)
  })
})
