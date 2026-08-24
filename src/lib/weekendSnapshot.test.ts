import { describe, expect, it } from 'vitest'
import { canOpenNextRound, findNextPremierLeagueWeekend } from './nextRound'
import {
  canCorrectOpenWindowSnapshot,
  inspectWeekendSnapshot,
  planOpenWindowSnapshotCorrection,
  selectEligibleWeekendFixtures,
} from './weekendSnapshot'
import type { SeasonFixture, SelectionWindowWithMeta } from '../types'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const artefactPath = join(__dirname, '..', '..', 'data', 'fixtures', '2026-27', 'fixtures.json')

function loadSeasonFixtures(): SeasonFixture[] {
  const artefact = JSON.parse(readFileSync(artefactPath, 'utf8')) as {
    fixtures: Array<{
      canonical_key: string
      season: string
      home_team_id: string
      away_team_id: string
      kickoff_at: string
      original_kickoff_at: string
      source_fixture_id: string | null
      home_team_name: string
      away_team_name: string
    }>
  }

  return artefact.fixtures.map((row) => ({
    id: row.canonical_key,
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

function row(
  id: string,
  home: string,
  away: string,
  kickoff: string,
  override: string | null = 'none',
) {
  return {
    season_fixture_id: id,
    home_team_id: home,
    away_team_id: away,
    kickoff_at: kickoff,
    eligibility_override: override,
    status: 'scheduled',
  }
}

describe('weekend snapshot eligibility', () => {
  const round2 = selectEligibleWeekendFixtures(
    loadSeasonFixtures().map((fixture) => ({
      season_fixture_id: fixture.id,
      home_team_id: fixture.home_team_id,
      away_team_id: fixture.away_team_id,
      kickoff_at: fixture.kickoff_at,
      eligibility_override: fixture.eligibility_override,
      status: fixture.status,
    })),
    '2026-08-29',
    '2026-08-30',
  )

  it('includes Saturday Round 2 fixtures', () => {
    expect(round2.some((fixture) => fixture.home_team_id === 'liv' && fixture.away_team_id === 'nfo')).toBe(true)
    expect(round2.some((fixture) => fixture.home_team_id === 'bou' && fixture.away_team_id === 'eve')).toBe(true)
    expect(round2.some((fixture) => fixture.home_team_id === 'cov' && fixture.away_team_id === 'hul')).toBe(true)
    expect(round2.some((fixture) => fixture.home_team_id === 'tot' && fixture.away_team_id === 'new')).toBe(true)
  })

  it('includes Sunday Round 2 fixtures', () => {
    expect(round2.some((fixture) => fixture.home_team_id === 'che' && fixture.away_team_id === 'bha')).toBe(true)
    expect(round2.some((fixture) => fixture.home_team_id === 'lee' && fixture.away_team_id === 'bre')).toBe(true)
    expect(round2.some((fixture) => fixture.home_team_id === 'sun' && fixture.away_team_id === 'ful')).toBe(true)
    expect(round2.some((fixture) => fixture.home_team_id === 'mun' && fixture.away_team_id === 'ips')).toBe(true)
    expect(round2).toHaveLength(8)
  })

  it('excludes Friday fixtures', () => {
    expect(round2.some((fixture) => fixture.home_team_id === 'cry' && fixture.away_team_id === 'mci')).toBe(false)
  })

  it('excludes Monday fixtures', () => {
    expect(round2.some((fixture) => fixture.home_team_id === 'avl' && fixture.away_team_id === 'ars')).toBe(false)
  })

  it('excludes midweek fixtures', () => {
    const midweek = selectEligibleWeekendFixtures(
      [row('wed', 'liv', 'che', '2026-09-02T19:00:00.000Z')],
      '2026-08-29',
      '2026-08-30',
    )
    expect(midweek).toEqual([])
  })

  it('uses Europe/London local day rather than naive UTC', () => {
    const sundayUtcMondayLondon = row('late', 'tot', 'new', '2026-08-30T23:00:00.000Z')
    expect(new Date(sundayUtcMondayLondon.kickoff_at).getUTCDay()).toBe(0)
    expect(selectEligibleWeekendFixtures([sundayUtcMondayLondon], '2026-08-29', '2026-08-30')).toEqual([])
  })

  it('blocks opening a round if non-Sat/Sun fixtures appear without an explicit exception', () => {
    const currentWindow: SelectionWindowWithMeta = {
      id: 'w2',
      game_id: 'g27',
      window_number: 2,
      start_at: '2026-08-20T00:00:00.000Z',
      end_at: '2026-08-24T00:00:00.000Z',
      deadline_at: '2026-08-21T15:00:00.000Z',
      status: 'resolved',
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-24T18:00:00.000Z',
      eligible_sat_date: '2026-08-22',
      eligible_sun_date: '2026-08-23',
      review_outcome: null,
      sync_run_id: null,
      earliest_kickoff_at: '2026-08-22T11:30:00.000Z',
      approved_at: '2026-08-01T00:00:00.000Z',
      approved_by_player_id: null,
    }
    const mondayOnly: SeasonFixture[] = [
      {
        ...loadSeasonFixtures()[0],
        id: 'mon',
        canonical_key: '2026/27|avl|ars|2026-08-31',
        home_team_id: 'avl',
        away_team_id: 'ars',
        kickoff_at: '2026-08-31T19:00:00.000Z',
        original_kickoff_at: '2026-08-31T19:00:00.000Z',
      },
    ]
    const check = canOpenNextRound({
      currentWindow,
      windows: [currentWindow],
      fixtures: mondayOnly,
      survivorCount: 23,
    })
    expect(check.canOpen).toBe(false)
  })

  it('corrects an open future window with zero picks and is idempotent', () => {
    const placeholderSaturday = [
      row('cry-mci', 'cry', 'mci', '2026-08-29T14:00:00.000Z'),
      row('liv-nfo', 'liv', 'nfo', '2026-08-29T14:00:00.000Z'),
      row('che-bha', 'che', 'bha', '2026-08-29T14:00:00.000Z'),
    ]
    const officialMaster = [
      row('cry-mci', 'cry', 'mci', '2026-08-28T19:00:00.000Z'),
      row('liv-nfo', 'liv', 'nfo', '2026-08-29T11:30:00.000Z'),
      row('che-bha', 'che', 'bha', '2026-08-30T13:00:00.000Z'),
    ]
    const first = planOpenWindowSnapshotCorrection({
      windowStatus: 'open',
      pickCount: 0,
      sat: '2026-08-29',
      sun: '2026-08-30',
      currentSnapshot: placeholderSaturday,
      masterFixtures: officialMaster,
    })
    expect(first.action).toBe('replace')
    expect(first.nextSnapshot).toHaveLength(2)
    expect(first.nextSnapshot.some((fixture) => fixture.home_team_id === 'cry')).toBe(false)

    const second = planOpenWindowSnapshotCorrection({
      windowStatus: 'open',
      pickCount: 0,
      sat: '2026-08-29',
      sun: '2026-08-30',
      currentSnapshot: first.nextSnapshot,
      masterFixtures: officialMaster,
    })
    expect(second.action).toBe('noop')
    expect(second.nextSnapshot).toEqual(first.nextSnapshot)
  })

  it('does not correct or delete a window that already has picks', () => {
    const gate = canCorrectOpenWindowSnapshot({ windowStatus: 'open', pickCount: 3 })
    expect(gate.ok).toBe(false)
    const planned = planOpenWindowSnapshotCorrection({
      windowStatus: 'open',
      pickCount: 3,
      sat: '2026-08-29',
      sun: '2026-08-30',
      currentSnapshot: [row('liv-nfo', 'liv', 'nfo', '2026-08-29T11:30:00.000Z')],
      masterFixtures: [row('liv-nfo', 'liv', 'nfo', '2026-08-29T11:30:00.000Z')],
    })
    expect(planned.action).toBe('blocked')
    expect(planned.nextSnapshot).toHaveLength(1)
  })

  it('marks a snapshot invalid when Friday or Monday fixtures are present', () => {
    const validity = inspectWeekendSnapshot([
      row('liv-nfo', 'liv', 'nfo', '2026-08-29T11:30:00.000Z'),
      row('cry-mci', 'cry', 'mci', '2026-08-28T19:00:00.000Z'),
    ])
    expect(validity.valid).toBe(false)
    expect(validity.saturdayCount).toBe(1)
    expect(validity.nonWeekend[0]?.londonDay).toBe('Friday')
  })
})

describe('artefact Round 2 weekend', () => {
  it('finds eight Saturday/Sunday fixtures and excludes Friday/Monday', () => {
    const weekend = findNextPremierLeagueWeekend(loadSeasonFixtures(), '2026-08-23')
    expect(weekend?.sat).toBe('2026-08-29')
    expect(weekend?.sun).toBe('2026-08-30')
    expect(weekend?.eligible).toHaveLength(8)
    expect(weekend?.fridayExcluded).toBeGreaterThanOrEqual(1)
    expect(weekend?.mondayExcluded).toBeGreaterThanOrEqual(1)
    expect(weekend?.eligible.some((fixture) => fixture.home_team_id === 'cry')).toBe(false)
    expect(weekend?.eligible.some((fixture) => fixture.home_team_id === 'avl')).toBe(false)
  })
})
