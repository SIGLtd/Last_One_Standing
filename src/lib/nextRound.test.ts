import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { SeasonFixture, SelectionWindowWithMeta } from '../types'
import { canOpenNextRound, findNextPremierLeagueWeekend } from './nextRound'
import { londonDayOfWeek } from '../../scripts/lib/fixtureValidation'
import { applyRoundResolution, resolveRoundPreview } from './roundResolution'
import {
  finallyUsedWindowIds,
  getFinallyUsedTeamsForPlayer,
  usedTeamIdsForPlayer,
  type UsedTeamWindow,
} from './pickOptions'

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

const resolvedRound1: UsedTeamWindow = {
  id: 'w2',
  window_number: 2,
  status: 'resolved',
  deadline_at: '2026-08-21T15:00:00.000Z',
}

const openRound2: UsedTeamWindow = {
  id: 'w3',
  window_number: 3,
  status: 'open',
  deadline_at: '2026-08-28T14:00:00.000Z',
}

const currentOpenRound1: UsedTeamWindow = {
  id: 'w2-open',
  window_number: 2,
  status: 'open',
  deadline_at: '2026-08-21T15:00:00.000Z',
}

describe('used teams and next round', () => {
  it('treats a resolved pick as finally used', () => {
    const used = getFinallyUsedTeamsForPlayer(
      [
        { player_id: 'p1', window_id: 'w2', team_id: 'mci', used_final: true },
      ],
      'p1',
      [resolvedRound1],
    )
    expect(used).toEqual(['mci'])
  })

  it('prevents a survivor from picking the same team next round', () => {
    const used = usedTeamIdsForPlayer(
      [{ player_id: 'p1', window_id: 'w2', team_id: 'mci', used_final: true }],
      'p1',
      finallyUsedWindowIds([resolvedRound1, openRound2]),
    )
    expect(used).toContain('mci')
    expect(used).not.toContain('liv')
  })

  it('does not treat a current-round amendment before the deadline as finally used', () => {
    const used = getFinallyUsedTeamsForPlayer(
      [
        { player_id: 'p1', window_id: 'w2-open', team_id: 'ars' },
      ],
      'p1',
      [currentOpenRound1],
      Date.parse('2026-08-20T12:00:00.000Z'),
    )
    expect(used).toEqual([])
  })

  it('does not use a passed deadline as a proxy for final used-team history', () => {
    const used = getFinallyUsedTeamsForPlayer(
      [{ player_id: 'p1', window_id: 'w2-open', team_id: 'mun' }],
      'p1',
      [currentOpenRound1],
      Date.parse('2026-08-24T12:00:00.000Z'),
    )
    expect(used).toEqual([])
  })

  it('opens the next round only for survivors', () => {
    const preview = resolveRoundPreview({
      window: { id: 'w2', window_number: 2, status: 'open', deadline_at: '2026-08-21T15:00:00.000Z' },
      fixtures: [
        {
          season_fixture_id: 'f-mci-bou',
          home_team_id: 'mci',
          away_team_id: 'bou',
          home_team_name: 'Manchester City',
          away_team_name: 'AFC Bournemouth',
          kickoff_at: '2026-08-23T13:00:00.000Z',
          status: 'finished',
          home_score: 3,
          away_score: 0,
          result_status: 'final',
        },
        {
          season_fixture_id: 'f-hul-mun',
          home_team_id: 'hul',
          away_team_id: 'mun',
          home_team_name: 'Hull City',
          away_team_name: 'Manchester United',
          kickoff_at: '2026-08-22T11:30:00.000Z',
          status: 'finished',
          home_score: 2,
          away_score: 1,
          result_status: 'final',
        },
      ],
      entries: [
        { player_id: 'survivor', display_name: 'Survivor', status: 'active', paid: true },
        { player_id: 'loser', display_name: 'Eliminated', status: 'active', paid: true },
      ],
      selections: [
        { player_id: 'survivor', team_id: 'mci' },
        { player_id: 'loser', team_id: 'mun' },
      ],
      nowMs: Date.parse('2026-08-24T12:00:00.000Z'),
    })

    const applied = applyRoundResolution(
      {
        windowStatus: 'open',
        resolvedAt: null,
        selections: [
          { playerId: 'survivor', teamId: 'mci', outcome: null, outcomeReason: null, usedFinal: false },
          { playerId: 'loser', teamId: 'mun', outcome: null, outcomeReason: null, usedFinal: false },
        ],
        entries: [
          { playerId: 'survivor', status: 'active', eliminatedReason: null },
          { playerId: 'loser', status: 'active', eliminatedReason: null },
        ],
      },
      preview,
      '2026-08-24T18:00:00.000Z',
    )

    const survivors = applied.entries.filter((entry) => entry.status === 'active')
    expect(survivors.map((entry) => entry.playerId)).toEqual(['survivor'])
    expect(applied.entries.find((entry) => entry.playerId === 'loser')?.status).toBe('eliminated')

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

    const check = canOpenNextRound({
      currentWindow,
      windows: [currentWindow],
      fixtures: loadSeasonFixtures(),
      survivorCount: survivors.length,
    })
    expect(check.canOpen).toBe(true)
    expect(check.weekend?.sat).toBe('2026-08-29')
    expect(check.weekend?.sun).toBe('2026-08-30')
    expect(check.weekend?.eligible).toHaveLength(8)
    expect(check.survivorCount).toBe(1)
  })

  it('does not open a duplicate next round when one is already open', () => {
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
    const nextWindow: SelectionWindowWithMeta = {
      ...currentWindow,
      id: 'w3',
      window_number: 3,
      status: 'open',
      eligible_sat_date: '2026-08-29',
      eligible_sun_date: '2026-08-30',
      deadline_at: '2026-08-28T14:00:00.000Z',
    }

    const check = canOpenNextRound({
      currentWindow,
      windows: [currentWindow, nextWindow],
      fixtures: loadSeasonFixtures(),
      survivorCount: 4,
    })
    expect(check.canOpen).toBe(false)
    expect(check.alreadyOpen).toBe(true)
  })

  it('finds the next Saturday/Sunday Premier League weekend after Round 1', () => {
    const weekend = findNextPremierLeagueWeekend(loadSeasonFixtures(), '2026-08-23')
    expect(weekend?.sat).toBe('2026-08-29')
    expect(weekend?.sun).toBe('2026-08-30')
    expect(weekend?.eligible).toHaveLength(8)
    expect(weekend?.eligible.some((fixture) => fixture.home_team_id === 'ful' && fixture.away_team_id === 'che')).toBe(
      false,
    )
    expect(weekend?.eligible.every((fixture) => [6, 7].includes(londonDayOfWeek(fixture.kickoff_at)))).toBe(true)
    expect(weekend?.eligible.some((fixture) => fixture.home_team_id === 'cry')).toBe(false)
    expect(weekend?.eligible.some((fixture) => fixture.home_team_id === 'avl')).toBe(false)
    expect(weekend?.fridayExcluded).toBeGreaterThanOrEqual(1)
    expect(weekend?.mondayExcluded).toBeGreaterThanOrEqual(1)
  })
})
