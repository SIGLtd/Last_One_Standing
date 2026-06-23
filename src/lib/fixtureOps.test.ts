import { describe, expect, it } from 'vitest'
import { buildSelectableTeamOptions } from './fixtureOps'
import { parsePickError, pickErrorLabel } from './pickErrors'
import {
  isPlayerFacingOpenWindow,
  isProtectedHistoricWindow,
  MIN_OPERATIONAL_WINDOW_NUMBER,
} from './windowGuards'
import { validateFixtureArtefact, type FixtureArtefactRow } from '../../scripts/lib/fixtureValidation'
import { canonicalKey, SEASON } from '../../scripts/lib/teamsCatalog'

function sampleFixture(overrides: Partial<FixtureArtefactRow> = {}): FixtureArtefactRow {
  const kickoff_at = '2026-08-22T14:00:00.000Z'
  return {
    source_fixture_id: null,
    canonical_key: canonicalKey(SEASON, 'ars', 'cov', kickoff_at),
    season: SEASON,
    home_team_id: 'ars',
    away_team_id: 'cov',
    kickoff_at,
    original_kickoff_at: kickoff_at,
    kickoff_london: '2026-08-22T15:00:00',
    home_team_name: 'Arsenal',
    away_team_name: 'Coventry City',
    ...overrides,
  }
}

describe('fixture validation', () => {
  it('rejects invalid fixture counts', () => {
    const result = validateFixtureArtefact([sampleFixture()])
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toContain('380')
  })

  it('rejects duplicate canonical keys', () => {
    const fixtures = Array.from({ length: 380 }, (_, index) =>
      sampleFixture({
        canonical_key: `dup-${index}`,
        home_team_id: 'ars',
        away_team_id: 'cov',
      }),
    )
    const result = validateFixtureArtefact(fixtures)
    expect(result.ok).toBe(false)
  })
})

describe('pick errors', () => {
  it('maps rpc codes to labels', () => {
    expect(parsePickError('ENTRY_INACTIVE')).toBe('ENTRY_INACTIVE')
    expect(pickErrorLabel('TEAM_ALREADY_USED')).toContain('already used')
  })
})

describe('selectable team options', () => {
  it('uses earliest kickoff when a team appears once', () => {
    const options = buildSelectableTeamOptions([
      {
        id: '1',
        window_id: 'w1',
        season_fixture_id: 'sf1',
        home_team_id: 'ars',
        away_team_id: 'cov',
        home_team_name: 'Arsenal',
        away_team_name: 'Coventry City',
        kickoff_at: '2026-08-22T14:00:00.000Z',
        snapshot_kickoff_at: '2026-08-22T14:00:00.000Z',
        fixture_status: 'scheduled',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ])

    expect(options).toHaveLength(2)
    expect(options.find((o: { team_id: string }) => o.team_id === 'ars')?.venue).toBe('Home')
  })
})

describe('window guards', () => {
  it('requires operational window number, open status, future deadline, and snapshot', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    expect(
      isPlayerFacingOpenWindow({
        window_number: MIN_OPERATIONAL_WINDOW_NUMBER,
        status: 'open',
        deadline_at: future,
        snapshot_fixture_count: 3,
      }),
    ).toBe(true)
    expect(isProtectedHistoricWindow(1)).toBe(true)
    expect(
      isPlayerFacingOpenWindow({
        window_number: 1,
        status: 'open',
        deadline_at: future,
        snapshot_fixture_count: 3,
      }),
    ).toBe(false)
  })
})
