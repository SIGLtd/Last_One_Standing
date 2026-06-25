import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { SeasonFixture, SelectionWindowWithMeta } from '../types'
import {
  buildWindow2ReadinessPreview,
  calculateProposedDeadline,
  evaluateWindow2FixtureEligibility,
  findDuplicateCanonicalKeys,
  WINDOW2_PREVIEW_SAT,
  WINDOW2_PREVIEW_SEASON,
  attachTeamNames,
} from './window2Preview'

const __dirname = dirname(fileURLToPath(import.meta.url))
const artefactPath = join(__dirname, '..', '..', 'data', 'fixtures', '2026-27', 'fixtures.json')

function seasonFixtureFromArtefact(row: {
  canonical_key: string
  season: string
  home_team_id: string
  away_team_id: string
  kickoff_at: string
  original_kickoff_at: string
  source_fixture_id: string | null
}): SeasonFixture {
  return {
    id: `id-${row.canonical_key}`,
    season: row.season,
    source_fixture_id: row.source_fixture_id,
    canonical_key: row.canonical_key,
    home_team_id: row.home_team_id,
    away_team_id: row.away_team_id,
    kickoff_at: row.kickoff_at,
    original_kickoff_at: row.original_kickoff_at,
    status: 'scheduled',
    home_score: null,
    away_score: null,
    result_status: 'pending',
    source_name: 'premier_league_official',
    source_url: 'https://example.com',
    source_retrieved_at: '2026-06-23T00:00:00.000Z',
    eligibility_override: 'none',
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
  }
}

function loadArtefactFixtures(): SeasonFixture[] {
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
  return artefact.fixtures.map(seasonFixtureFromArtefact)
}

function baseContext() {
  return {
    targetSat: WINDOW2_PREVIEW_SAT,
    targetSun: '2026-08-23',
    duplicateKeys: new Set<string>(),
  }
}

describe('window2 readiness preview', () => {
  it('includes Saturday and Sunday opening-weekend fixtures from the official baseline', () => {
    const preview = buildWindow2ReadinessPreview(loadArtefactFixtures(), [])
    expect(preview.eligibleCount).toBe(8)
    expect(preview.reviewed).toHaveLength(8)
  })

  it('excludes Friday, Monday, and midweek fixtures outside the target weekend', () => {
    const fixtures = loadArtefactFixtures()
    const friday = fixtures.find((f) => f.canonical_key.includes('|2026-08-21'))!
    const monday = seasonFixtureFromArtefact({
      canonical_key: '2026/27|che|liv|2026-08-24',
      season: WINDOW2_PREVIEW_SEASON,
      home_team_id: 'che',
      away_team_id: 'liv',
      kickoff_at: '2026-08-24T19:00:00.000Z',
      original_kickoff_at: '2026-08-24T19:00:00.000Z',
      source_fixture_id: null,
    })

    const preview = buildWindow2ReadinessPreview([...fixtures, monday], [])
    expect(preview.reviewed.some((row) => row.fixture.id === friday.id)).toBe(false)
    expect(preview.reviewed.some((row) => row.fixture.id === monday.id)).toBe(false)
    expect(preview.warnings.some((w) => w.includes('Friday 21 Aug 2026'))).toBe(true)
  })

  it('calculates the deadline exactly one hour before the earliest eligible kick-off', () => {
    const preview = buildWindow2ReadinessPreview(loadArtefactFixtures(), [])
    expect(preview.earliestEligibleKickoff).toBe('2026-08-22T11:30:00.000Z')
    expect(preview.proposedDeadline).toBe('2026-08-22T10:30:00.000Z')
    expect(calculateProposedDeadline('2026-08-22T11:30:00.000Z')).toBe('2026-08-22T10:30:00.000Z')
  })

  it('handles Europe/London date boundaries for late-evening UTC kick-offs', () => {
    const lateUtcSaturday = seasonFixtureFromArtefact({
      canonical_key: '2026/27|ful|ars|2026-08-22',
      season: WINDOW2_PREVIEW_SEASON,
      home_team_id: 'ful',
      away_team_id: 'ars',
      kickoff_at: '2026-08-22T22:30:00.000Z',
      original_kickoff_at: '2026-08-22T22:30:00.000Z',
      source_fixture_id: null,
    })

    const result = evaluateWindow2FixtureEligibility(attachTeamNames(lateUtcSaturday), baseContext())
    expect(result.eligible).toBe(true)
  })

  it('flags cancelled, postponed, and unmapped fixtures as excluded', () => {
    const cancelled = attachTeamNames({
      ...seasonFixtureFromArtefact({
        canonical_key: '2026/27|ars|tot|2026-08-22',
        season: WINDOW2_PREVIEW_SEASON,
        home_team_id: 'ars',
        away_team_id: 'tot',
        kickoff_at: '2026-08-22T14:00:00.000Z',
        original_kickoff_at: '2026-08-22T14:00:00.000Z',
        source_fixture_id: null,
      }),
      status: 'cancelled',
    })
    const postponed = attachTeamNames({
      ...seasonFixtureFromArtefact({
        canonical_key: '2026/27|avl|bre|2026-08-23',
        season: WINDOW2_PREVIEW_SEASON,
        home_team_id: 'avl',
        away_team_id: 'bre',
        kickoff_at: '2026-08-23T14:00:00.000Z',
        original_kickoff_at: '2026-08-23T14:00:00.000Z',
        source_fixture_id: null,
      }),
      status: 'postponed',
    })
    const unmapped = attachTeamNames({
      ...seasonFixtureFromArtefact({
        canonical_key: '2026/27|xxx|yyy|2026-08-23',
        season: WINDOW2_PREVIEW_SEASON,
        home_team_id: 'xxx',
        away_team_id: 'yyy',
        kickoff_at: '2026-08-23T14:00:00.000Z',
        original_kickoff_at: '2026-08-23T14:00:00.000Z',
        source_fixture_id: null,
      }),
    })

    expect(evaluateWindow2FixtureEligibility(cancelled, baseContext()).reason).toBe('Cancelled')
    expect(evaluateWindow2FixtureEligibility(postponed, baseContext()).reason).toBe('Postponed')
    expect(evaluateWindow2FixtureEligibility(unmapped, baseContext()).eligible).toBe(false)
  })

  it('does not perform database writes in the pure preview builder', () => {
    const preview = buildWindow2ReadinessPreview(loadArtefactFixtures(), [])
    expect(preview.previewOnly).toBe(true)
    expect(findDuplicateCanonicalKeys(loadArtefactFixtures()).size).toBe(0)
  })

  it('warns when an operational Window 2 or later record exists without touching Window 1', () => {
    const windows: SelectionWindowWithMeta[] = [
      {
        id: 'w1',
        game_id: 'g1',
        window_number: 1,
        status: 'open',
        start_at: null,
        end_at: null,
        deadline_at: '2026-01-01T12:00:00.000Z',
        eligible_sat_date: null,
        eligible_sun_date: null,
        review_outcome: null,
        sync_run_id: null,
        earliest_kickoff_at: null,
        approved_at: null,
        approved_by_player_id: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'w2',
        game_id: 'g1',
        window_number: 2,
        status: 'pending',
        start_at: null,
        end_at: null,
        deadline_at: '2026-08-22T10:30:00.000Z',
        eligible_sat_date: WINDOW2_PREVIEW_SAT,
        eligible_sun_date: '2026-08-23',
        review_outcome: null,
        sync_run_id: null,
        earliest_kickoff_at: '2026-08-22T11:30:00.000Z',
        approved_at: null,
        approved_by_player_id: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]

    const preview = buildWindow2ReadinessPreview(loadArtefactFixtures(), windows)
    expect(preview.existingOperationalWindows).toEqual([{ window_number: 2, status: 'pending' }])
    expect(preview.warnings.some((w) => w.includes('#2 (pending)'))).toBe(true)
    expect(preview.warnings.some((w) => w.includes('#1'))).toBe(false)
  })
})
