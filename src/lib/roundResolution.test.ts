import { describe, expect, it } from 'vitest'
import {
  applyRoundCorrection,
  applyRoundResolution,
  mergeEligibleFixturesWithResults,
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
  knownSubmittedPicks?: number
}) {
  return resolveRoundPreview({
    window: input.window ?? round1Window,
    fixtures: input.fixtures ?? [hullUnited, cityBournemouth, newcastleLiverpool],
    entries: input.entries ?? [entry('p-city', 'City Fan'), entry('p-united', 'United Fan')],
    selections: input.selections ?? [selection('p-city', 'mci'), selection('p-united', 'mun')],
    nowMs: input.nowMs ?? afterDeadline,
    knownSubmittedPicks: input.knownSubmittedPicks,
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

  it('audits an already-resolved Round 1 from stored outcomes without enabling resolve', () => {
    const result = preview({
      window: { ...round1Window, status: 'resolved' },
      entries: [
        entry('p-city', 'City Fan', { status: 'active' }),
        entry('p-united', 'United Fan', { status: 'eliminated' }),
        entry('p-late', 'No Pick', { status: 'eliminated' }),
      ],
      selections: [
        { player_id: 'p-city', team_id: 'mci', outcome: 'survived', outcome_reason: 'win', used_final: true },
        { player_id: 'p-united', team_id: 'mun', outcome: 'eliminated', outcome_reason: 'loss', used_final: true },
        { player_id: 'p-late', team_id: null, outcome: 'no_pick', outcome_reason: 'no_pick', used_final: false },
      ],
    })
    expect(result.alreadyResolved).toBe(true)
    expect(result.readyToResolve).toBe(false)
    expect(result.picksSubmitted).toBe(2)
    expect(result.survived).toBe(1)
    expect(result.eliminated).toBe(1)
    expect(result.noPicks).toBe(1)
    expect(result.pending).toBe(0)
    expect(result.blockedReason).toMatch(/already resolved/i)
  })

  it('keeps the correction path idempotent when Round 1 is already correct', () => {
    const result = preview({
      window: { ...round1Window, status: 'resolved' },
      entries: [
        entry('p-city', 'City Fan', { status: 'active' }),
        entry('p-united', 'United Fan', { status: 'eliminated' }),
      ],
      selections: [
        { player_id: 'p-city', team_id: 'mci', outcome: 'survived', outcome_reason: 'win', used_final: true },
        { player_id: 'p-united', team_id: 'mun', outcome: 'eliminated', outcome_reason: 'loss', used_final: true },
      ],
    })
    const state: RoundResolutionState = {
      windowStatus: 'resolved',
      resolvedAt: '2026-08-24T18:11:43.000Z',
      selections: [
        { playerId: 'p-city', teamId: 'mci', outcome: 'survived', outcomeReason: 'win', usedFinal: true },
        { playerId: 'p-united', teamId: 'mun', outcome: 'eliminated', outcomeReason: 'loss', usedFinal: true },
      ],
      entries: [
        { playerId: 'p-city', status: 'active', eliminatedReason: null },
        { playerId: 'p-united', status: 'eliminated', eliminatedReason: 'loss' },
      ],
    }
    const once = applyRoundCorrection(state, result, '2026-08-24T20:00:00.000Z')
    const twice = applyRoundCorrection(once, result, '2026-08-24T21:00:00.000Z')
    expect(once).toEqual(state)
    expect(twice).toEqual(once)
    expect(twice.resolvedAt).toBe('2026-08-24T18:11:43.000Z')
    expect(twice.selections.find((row) => row.playerId === 'p-city')?.teamId).toBe('mci')
  })

  it('counts submitted picks by the selected window_id', () => {
    const result = preview({
      selections: [
        { player_id: 'p-city', team_id: 'mci', window_id: 'w2' },
        { player_id: 'p-united', team_id: 'mun', window_id: 'w3' },
      ],
    })
    expect(result.picksSubmitted).toBe(1)
  })

  it('treats an active entry with no pick as no_pick after the deadline, not pending', () => {
    const result = preview({
      entries: [entry('p-late', 'No Pick')],
      selections: [],
      nowMs: afterDeadline,
    })
    expect(result.noPicks).toBe(1)
    expect(result.pending).toBe(0)
    expect(result.rows[0]?.group).toBe('no_pick')
  })

  it('uses pending only when the selected fixture has no final result', () => {
    const result = preview({
      fixtures: [unfinishedCity],
      entries: [entry('p-city', 'City Fan')],
      selections: [selection('p-city', 'mci')],
    })
    expect(result.pending).toBe(1)
    expect(result.noPicks).toBe(0)
    expect(result.rows[0]?.outcomeReason).toBe('unresolved')
  })

  it('does not count already-eliminated players as pending on the next unresolved window', () => {
    const result = preview({
      window: { id: 'w3', window_number: 3, status: 'open', deadline_at: '2026-08-28T15:00:00.000Z' },
      entries: [
        entry('survivor', 'Survivor'),
        entry('loser', 'Already out', { status: 'eliminated' }),
        entry('late', 'Still in'),
      ],
      selections: [],
      nowMs: Date.parse('2026-08-24T18:30:00.000Z'),
    })
    expect(result.activeEntrants).toBe(2)
    expect(result.pending).toBe(2)
    expect(result.pending).toBeLessThanOrEqual(result.activeEntrants)
    expect(result.rows.some((row) => row.playerId === 'loser')).toBe(false)
  })

  it('recognises the Round 1 deadline from a Postgres UTC timestamp', () => {
    const result = preview({
      window: { ...round1Window, deadline_at: '2026-08-21 15:00:00+00' },
      nowMs: Date.parse('2026-08-21T15:00:01.000Z'),
    })
    expect(result.deadlinePassed).toBe(true)
    expect(result.blockedReason ?? '').not.toMatch(/has not passed/)
  })

  it('disables resolve when preview data is suspicious', () => {
    const zeroPicks = preview({
      entries: [entry('p-city', 'City Fan')],
      selections: [],
      knownSubmittedPicks: 91,
    })
    expect(zeroPicks.picksSubmitted).toBe(0)
    expect(zeroPicks.readyToResolve).toBe(false)
    expect(zeroPicks.previewInconsistent).toBe(true)

    const monday = preview({
      fixtures: [
        {
          ...hullUnited,
          kickoff_at: '2026-08-24T19:00:00.000Z',
        },
      ],
    })
    expect(monday.readyToResolve).toBe(false)
    expect(monday.safetyIssues.some((issue) => issue.toLowerCase().includes('saturday/sunday'))).toBe(true)

    const noFixtures = preview({ fixtures: [] })
    expect(noFixtures.readyToResolve).toBe(false)
  })

  it('does not let result merge mutate eligible fixture snapshots', () => {
    const snapshots = [
      {
        season_fixture_id: 'f-hul-mun',
        home_team_id: 'hul',
        away_team_id: 'mun',
        home_team_name: 'Hull City',
        away_team_name: 'Manchester United',
        kickoff_at: '2026-08-22T11:30:00.000Z',
        fixture_status: 'scheduled',
      },
    ]
    const season = [
      {
        id: 'f-hul-mun',
        status: 'finished',
        home_score: 2,
        away_score: 0,
        result_status: 'final',
      },
    ]
    const merged = mergeEligibleFixturesWithResults(snapshots, season)
    expect(snapshots[0]?.fixture_status).toBe('scheduled')
    expect(merged[0]?.status).toBe('finished')
    expect(merged[0]?.home_score).toBe(2)
    expect(merged[0]?.kickoff_at).toBe(snapshots[0]?.kickoff_at)
  })

  it('recalculates one accepted late pick after the round is resolved', () => {
    const munIpswich: ResolutionFixture = {
      season_fixture_id: 'f-mun-ips',
      home_team_id: 'mun',
      away_team_id: 'ips',
      home_team_name: 'Manchester United',
      away_team_name: 'Ipswich Town',
      kickoff_at: '2026-08-30T15:30:00.000Z',
      status: 'finished',
      home_score: 2,
      away_score: 1,
      result_status: 'final',
    }
    const round2: RoundResolutionWindow = {
      id: 'w3',
      window_number: 3,
      status: 'resolved',
      deadline_at: '2026-08-28T15:00:00.000Z',
    }
    const before = preview({
      window: round2,
      fixtures: [munIpswich],
      entries: [
        entry('p-other', 'Other Survivor', { status: 'active' }),
        entry('p-mills', 'David Mills', { status: 'eliminated' }),
      ],
      selections: [
        { player_id: 'p-other', team_id: 'che', outcome: 'survived', outcome_reason: 'win', used_final: true },
        { player_id: 'p-mills', team_id: null, outcome: 'no_pick', outcome_reason: 'no_pick', used_final: false },
      ],
    })
    expect(before.survived).toBe(1)

    const after = preview({
      window: round2,
      fixtures: [munIpswich],
      entries: [
        entry('p-other', 'Other Survivor', { status: 'active' }),
        entry('p-mills', 'David Mills', { status: 'active' }),
      ],
      selections: [
        { player_id: 'p-other', team_id: 'che', outcome: 'survived', outcome_reason: 'win', used_final: true },
        {
          player_id: 'p-mills',
          team_id: 'mun',
          outcome: 'survived',
          outcome_reason: 'win',
          used_final: true,
        },
      ],
    })
    expect(after.survived).toBe(2)
    expect(after.rows.find((row) => row.playerId === 'p-mills')?.group).toBe('survived')
    expect(after.rows.find((row) => row.playerId === 'p-other')?.group).toBe('survived')

    const state: RoundResolutionState = {
      windowStatus: 'resolved',
      resolvedAt: '2026-09-01T12:00:00.000Z',
      selections: [
        { playerId: 'p-other', teamId: 'che', outcome: 'survived', outcomeReason: 'win', usedFinal: true },
        { playerId: 'p-mills', teamId: 'mun', outcome: 'survived', outcomeReason: 'win', usedFinal: true },
      ],
      entries: [
        { playerId: 'p-other', status: 'active', eliminatedReason: null },
        { playerId: 'p-mills', status: 'active', eliminatedReason: null },
      ],
    }
    const corrected = applyRoundCorrection(state, after, '2026-09-01T16:00:00.000Z')
    expect(corrected.entries.find((row) => row.playerId === 'p-mills')?.status).toBe('active')
    expect(corrected.selections.find((row) => row.playerId === 'p-mills')?.usedFinal).toBe(true)
    expect(corrected.selections.find((row) => row.playerId === 'p-other')?.teamId).toBe('che')
  })

  it('treats a Manchester United win as a surviving Round 2 pick while the round is still open', () => {
    const munIpswich: ResolutionFixture = {
      season_fixture_id: 'f-mun-ips',
      home_team_id: 'mun',
      away_team_id: 'ips',
      home_team_name: 'Manchester United',
      away_team_name: 'Ipswich Town',
      kickoff_at: '2026-08-30T15:30:00.000Z',
      status: 'finished',
      home_score: 2,
      away_score: 1,
      result_status: 'final',
    }
    const result = preview({
      window: {
        id: 'w3',
        window_number: 3,
        status: 'open',
        deadline_at: '2026-08-28T15:00:00.000Z',
      },
      fixtures: [munIpswich],
      entries: [entry('p-mills', 'David Mills')],
      selections: [selection('p-mills', 'mun')],
      nowMs: Date.parse('2026-09-01T15:00:00.000Z'),
    })
    expect(result.alreadyResolved).toBe(false)
    expect(result.survived).toBe(1)
    expect(result.rows[0]?.displayName).toBe('David Mills')
    expect(result.rows[0]?.outcomeReason).toBe('win')
    expect(result.rows[0]?.usedFinal).toBe(true)
  })
})
