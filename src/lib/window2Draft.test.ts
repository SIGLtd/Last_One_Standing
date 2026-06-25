import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { SeasonFixture, SelectionWindowEligibleFixture } from '../types'
import {
  WINDOW2_EARLIEST_KICKOFF_UTC,
  WINDOW2_PROPOSED_DEADLINE_UTC,
  compareDraftSnapshotToMaster,
  isDraftOperationalWindow,
  shouldShowPlayerPickForm,
  window2DraftSummary,
} from './window2Draft'
import { buildWindow2ReadinessPreview } from './window2Preview'
import { isProtectedHistoricWindow, isPlayerFacingOpenWindow } from './windowGuards'

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

describe('window2 draft', () => {
  it('treats pending Window 2 as draft and does not permit player selections', () => {
    const draft = {
      window_number: 2,
      status: 'pending',
      deadline_at: WINDOW2_PROPOSED_DEADLINE_UTC,
    }

    expect(isDraftOperationalWindow(draft)).toBe(true)
    expect(shouldShowPlayerPickForm(draft)).toBe(false)
    expect(
      isPlayerFacingOpenWindow({
        window_number: 2,
        status: 'pending',
        deadline_at: WINDOW2_PROPOSED_DEADLINE_UTC,
        snapshot_fixture_count: 8,
      }),
    ).toBe(false)
  })

  it('does not consume team usage from a draft Window 2', () => {
    const summary = window2DraftSummary({
      window_number: 2,
      status: 'pending',
      eligible_sat_date: '2026-08-22',
      eligible_sun_date: '2026-08-23',
      deadline_at: WINDOW2_PROPOSED_DEADLINE_UTC,
      earliest_kickoff_at: WINDOW2_EARLIEST_KICKOFF_UTC,
    })

    expect(summary.playerSelectionsPermitted).toBe(false)
    expect(summary.isWindow2Draft).toBe(true)
  })

  it('leaves Window 1 protected and unchanged in draft summary checks', () => {
    expect(isProtectedHistoricWindow(1)).toBe(true)
    expect(
      window2DraftSummary({
        window_number: 1,
        status: 'open',
        eligible_sat_date: null,
        eligible_sun_date: null,
        deadline_at: '2026-01-01T12:00:00.000Z',
        earliest_kickoff_at: null,
      }).isProtectedWindow1Untouched,
    ).toBe(true)
  })

  it('compares draft snapshot against master fixtures without approval actions', () => {
    const snapshot = snapshotFromMaster()
    const comparison = compareDraftSnapshotToMaster(snapshot, loadArtefactSeasonFixtures())
    expect(comparison.matchesMaster).toBe(true)
    expect(comparison.masterEligibleCount).toBe(8)
    expect(comparison.snapshotFixtureCount).toBe(8)
    expect(comparison.differences).toEqual([])
  })

  it('flags snapshot drift before publication', () => {
    const snapshot = snapshotFromMaster().slice(0, 7)
    const comparison = compareDraftSnapshotToMaster(snapshot, loadArtefactSeasonFixtures())
    expect(comparison.matchesMaster).toBe(false)
    expect(comparison.differences.length).toBeGreaterThan(0)
  })

  it('expects exactly one operational Window 2 draft record in controlled creation', () => {
    const windows = [
      { window_number: 1, status: 'open' },
      { window_number: 2, status: 'pending' },
    ]
    const window2Records = windows.filter((w) => w.window_number === 2)
    expect(window2Records).toHaveLength(1)
    expect(isDraftOperationalWindow(window2Records[0])).toBe(true)
  })
})
