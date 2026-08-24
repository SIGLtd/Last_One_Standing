import { describe, expect, it } from 'vitest'
import {
  applyRoundResolution,
  resolveRoundPreview,
  type ResolutionEntry,
  type ResolutionFixture,
  type ResolutionSelection,
  type RoundResolutionState,
  type RoundResolutionWindow,
} from './roundResolution'

const afterDeadline = Date.parse('2026-08-24T12:00:00.000Z')
const beforeDeadline = Date.parse('2026-08-21T12:00:00.000Z')

const round1Window: RoundResolutionWindow = {
  id: 'w2',
  window_number: 2,
  status: 'open',
  deadline_at: '2026-08-21T15:00:00.000Z',
}

const hullUnited: ResolutionFixture = {
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
}

const cityBournemouth: ResolutionFixture = {
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
}

const newcastleLiverpool: ResolutionFixture = {
  season_fixture_id: 'f-new-liv',
  home_team_id: 'new',
  away_team_id: 'liv',
  home_team_name: 'Newcastle United',
  away_team_name: 'Liverpool',
  kickoff_at: '2026-08-23T15:30:00.000Z',
  status: 'finished',
  home_score: 0,
  away_score: 0,
  result_status: 'final',
}

const unfinishedCity: ResolutionFixture = {
  ...cityBournemouth,
  status: 'in_play',
  home_score: 1,
  away_score: 0,
  result_status: 'pending',
}

function entry(playerId: string, displayName: string, overrides: Partial<ResolutionEntry> = {}): ResolutionEntry {
  return {
    player_id: playerId,
    display_name: displayName,
    status: 'active',
    paid: true,
    ...overrides,
  }
}

function selection(playerId: string, teamId: string | null): ResolutionSelection {
  return {
    player_id: playerId,
    team_id: teamId,
    updated_at: '2026-08-20T10:00:00.000Z',
  }
}

function preview(input: {
  fixtures?: ResolutionFixture[]
  entries?: ResolutionEntry[]
  selections?: ResolutionSelection[]
  nowMs?: number
  window?: RoundResolutionWindow
}) {
  return resolveRoundPreview({
    window: input.window ?? round1Window,
    fixtures: input.fixtures ?? [hullUnited, cityBournemouth, newcastleLiverpool],
    entries: input.entries ?? [entry('p-city', 'City Fan'), entry('p-united', 'United Fan')],
    selections: input.selections ?? [selection('p-city', 'mci'), selection('p-united', 'mun')],
    nowMs: input.nowMs ?? afterDeadline,
  })
}

describe('round resolution', () => {
  it('lets a winning picked team survive', () => {
    const result = preview({
      entries: [entry('p-city', 'City Fan')],
      selections: [selection('p-city', 'mci')],
    })
    expect(result.survived).toBe(1)
    expect(result.rows[0]?.group).toBe('survived')
    expect(result.rows[0]?.outcomeReason).toBe('win')
  })

  it('eliminates a losing picked team', () => {
    const result = preview({
      entries: [entry('p-united', 'United Fan')],
      selections: [selection('p-united', 'mun')],
    })
    expect(result.eliminated).toBe(1)
    expect(result.rows[0]?.group).toBe('eliminated')
    expect(result.rows[0]?.outcomeReason).toBe('loss')
  })

  it('eliminates a drawing picked team', () => {
    const result = preview({
      entries: [entry('p-liv', 'Liverpool Fan')],
      selections: [selection('p-liv', 'liv')],
    })
    expect(result.rows[0]?.group).toBe('eliminated')
    expect(result.rows[0]?.outcomeReason).toBe('draw')
  })

  it('eliminates a no-pick after the deadline', () => {
    const result = preview({
      entries: [entry('p-late', 'No Pick')],
      selections: [],
    })
    expect(result.noPicks).toBe(1)
    expect(result.rows[0]?.group).toBe('no_pick')
    expect(result.rows[0]?.outcome).toBe('no_pick')
  })

  it('eliminates a Manchester United pick after a Hull win in Round 1 fixture tests', () => {
    const result = preview({
      entries: [entry('p-united', 'United Fan')],
      selections: [selection('p-united', 'mun')],
    })
    expect(result.rows[0]?.teamId).toBe('mun')
    expect(result.rows[0]?.group).toBe('eliminated')
    expect(result.rows[0]?.scoreLabel).toContain('Hull City')
    expect(result.rows[0]?.scoreLabel).toContain('2–1')
  })

  it('lets a Manchester City pick survive in Round 1 fixture tests', () => {
    const result = preview({
      entries: [entry('p-city', 'City Fan')],
      selections: [selection('p-city', 'mci')],
    })
    expect(result.rows[0]?.teamId).toBe('mci')
    expect(result.rows[0]?.group).toBe('survived')
  })

  it('eliminates both sides of a Liverpool/Newcastle draw', () => {
    const result = preview({
      entries: [entry('p-liv', 'Liverpool Fan'), entry('p-new', 'Newcastle Fan')],
      selections: [selection('p-liv', 'liv'), selection('p-new', 'new')],
    })
    expect(result.survived).toBe(0)
    expect(result.eliminated).toBe(2)
    expect(result.rows.every((row) => row.outcomeReason === 'draw')).toBe(true)
  })

  it('marks an unresolved selected fixture as pending and blocks unsafe resolution', () => {
    const result = preview({
      fixtures: [hullUnited, unfinishedCity, newcastleLiverpool],
      entries: [entry('p-city', 'City Fan')],
      selections: [selection('p-city', 'mci')],
    })
    expect(result.pending).toBe(1)
    expect(result.readyToResolve).toBe(false)
    expect(result.blockedReason).toMatch(/not final/i)
  })

  it('does not mutate input during preview', () => {
    const entries = [entry('p-city', 'City Fan')]
    const selections = [selection('p-city', 'mci')]
    const fixtures = [cityBournemouth]
    const first = resolveRoundPreview({
      window: round1Window,
      fixtures,
      entries,
      selections,
      nowMs: afterDeadline,
    })
    const second = resolveRoundPreview({
      window: round1Window,
      fixtures,
      entries,
      selections,
      nowMs: afterDeadline,
    })
    expect(first).toEqual(second)
    expect(entries[0]?.status).toBe('active')
    expect(selections[0]?.team_id).toBe('mci')
    expect(fixtures[0]?.home_score).toBe(3)
  })

  it('applies resolution idempotently', () => {
    const result = preview({})
    const initial: RoundResolutionState = {
      windowStatus: 'open',
      resolvedAt: null,
      selections: [
        { playerId: 'p-city', teamId: 'mci', outcome: null, outcomeReason: null, usedFinal: false },
        { playerId: 'p-united', teamId: 'mun', outcome: null, outcomeReason: null, usedFinal: false },
      ],
      entries: [
        { playerId: 'p-city', status: 'active', eliminatedReason: null },
        { playerId: 'p-united', status: 'active', eliminatedReason: null },
      ],
    }

    const once = applyRoundResolution(initial, result, '2026-08-24T18:00:00.000Z')
    const twice = applyRoundResolution(once, result, '2026-08-24T19:00:00.000Z')

    expect(once.windowStatus).toBe('resolved')
    expect(once.entries.find((entryRow) => entryRow.playerId === 'p-city')?.status).toBe('active')
    expect(once.entries.find((entryRow) => entryRow.playerId === 'p-united')?.status).toBe('eliminated')
    expect(once.selections.find((row) => row.playerId === 'p-city')?.usedFinal).toBe(true)
    expect(twice).toEqual(once)
    expect(twice.resolvedAt).toBe('2026-08-24T18:00:00.000Z')
  })

  it('does not apply while selected fixtures are pending', () => {
    const result = preview({
      fixtures: [unfinishedCity],
      entries: [entry('p-city', 'City Fan')],
      selections: [selection('p-city', 'mci')],
    })
    const state: RoundResolutionState = {
      windowStatus: 'open',
      resolvedAt: null,
      selections: [{ playerId: 'p-city', teamId: 'mci', outcome: null, outcomeReason: null, usedFinal: false }],
      entries: [{ playerId: 'p-city', status: 'active', eliminatedReason: null }],
    }
    const applied = applyRoundResolution(state, result, '2026-08-24T18:00:00.000Z')
    expect(result.readyToResolve).toBe(false)
    expect(applied.windowStatus).toBe('open')
    expect(applied.entries[0]?.status).toBe('active')
  })

  it('keeps a current-round missing pick pending before the deadline', () => {
    const result = preview({
      entries: [entry('p-late', 'No Pick')],
      selections: [],
      nowMs: beforeDeadline,
    })
    expect(result.rows[0]?.group).toBe('pending')
    expect(result.readyToResolve).toBe(false)
  })

  it('excludes withdrawn entries from live survival', () => {
    const result = preview({
      entries: [entry('p-city', 'City Fan'), entry('p-out', 'Withdrawn', { status: 'withdrawn' })],
      selections: [selection('p-city', 'mci')],
    })
    expect(result.activeEntrants).toBe(1)
    expect(result.withdrawn).toBe(1)
    expect(result.survived).toBe(1)
  })
})
