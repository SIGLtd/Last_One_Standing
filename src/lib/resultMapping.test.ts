import { describe, expect, it } from 'vitest'
import {
  buildResultSyncPatch,
  isProviderResultFinal,
  mapProviderResultToFixture,
  mapProviderResultsToFixtures,
  shouldStoreFinalScore,
  type AppFixtureInput,
  type ProviderMatchInput,
} from './resultMapping'

function fixture(overrides: Partial<AppFixtureInput> = {}): AppFixtureInput {
  return {
    id: 'fx-hul-mun',
    source_fixture_id: '497001',
    canonical_key: '2026/27|hul|mun|2026-08-22',
    home_team_id: 'hul',
    away_team_id: 'mun',
    kickoff_at: '2026-08-22T11:30:00.000Z',
    status: 'scheduled',
    home_score: null,
    away_score: null,
    result_status: 'pending',
    ...overrides,
  }
}

function provider(overrides: Partial<ProviderMatchInput> = {}): ProviderMatchInput {
  return {
    providerFixtureId: '497001',
    homeTeamId: 'hul',
    awayTeamId: 'mun',
    kickoffAt: '2026-08-22T11:30:00.000Z',
    canonicalKey: '2026/27|hul|mun|2026-08-22',
    status: 'finished',
    homeScore: 2,
    awayScore: 1,
    resultStatus: 'final',
    providerStatus: 'FINISHED',
    ...overrides,
  }
}

describe('provider result mapping', () => {
  it('maps a provider result to a fixture by provider ID when available', () => {
    const mapped = mapProviderResultToFixture(provider(), [
      fixture(),
      fixture({
        id: 'fx-other',
        source_fixture_id: '497999',
        canonical_key: '2026/27|mci|bou|2026-08-23',
        home_team_id: 'mci',
        away_team_id: 'bou',
      }),
    ])
    expect(mapped.kind).toBe('matched')
    if (mapped.kind !== 'matched') return
    expect(mapped.method).toBe('provider_id')
    expect(mapped.fixture.id).toBe('fx-hul-mun')
  })

  it('maps by canonical home/away/date key when provider ID is missing', () => {
    const mapped = mapProviderResultToFixture(provider(), [
      fixture({ source_fixture_id: null }),
    ])
    expect(mapped.kind).toBe('matched')
    if (mapped.kind !== 'matched') return
    expect(mapped.method).toBe('canonical_key')
  })

  it('rejects ambiguous provider matches', () => {
    const duplicates = [
      fixture({ id: 'a', source_fixture_id: null }),
      fixture({ id: 'b', source_fixture_id: null }),
    ]
    const mapped = mapProviderResultToFixture(provider({ providerFixtureId: 'missing' }), duplicates)
    expect(mapped.kind).toBe('ambiguous')
    if (mapped.kind !== 'ambiguous') return
    expect(mapped.fixtureIds).toEqual(['a', 'b'])
  })

  it('rejects when provider ID and canonical key point at different fixtures', () => {
    const mapped = mapProviderResultToFixture(provider(), [
      fixture({ id: 'by-id', source_fixture_id: '497001', canonical_key: '2026/27|hul|mun|2026-08-22' }),
      fixture({
        id: 'by-key',
        source_fixture_id: 'other',
        canonical_key: '2026/27|hul|mun|2026-08-22',
      }),
    ])
    expect(mapped.kind).toBe('ambiguous')
  })

  it('stores a final score on the season fixture row, not on a window snapshot', () => {
    const finished = provider()
    expect(isProviderResultFinal(finished)).toBe(true)
    expect(shouldStoreFinalScore(finished)).toBe(true)
    const patch = buildResultSyncPatch({
      kind: 'matched',
      fixture: fixture(),
      provider: finished,
      method: 'provider_id',
    })
    expect(patch.fixtureId).toBe('fx-hul-mun')
    expect(patch.storeFinal).toBe(true)
    expect(patch.status).toBe('finished')
    expect(patch.homeScore).toBe(2)
    expect(patch.awayScore).toBe(1)
    expect(patch.resultStatus).toBe('final')
    expect(Object.keys(patch)).not.toContain('windowId')
    expect(Object.keys(patch)).not.toContain('snapshotId')
  })

  it('handles postponed and unavailable fixtures without guessing', () => {
    const postponed = provider({
      status: 'postponed',
      resultStatus: 'pending',
      homeScore: 1,
      awayScore: 0,
      providerStatus: 'POSTPONED',
    })
    expect(isProviderResultFinal(postponed)).toBe(false)
    expect(shouldStoreFinalScore(postponed)).toBe(false)
    const patch = buildResultSyncPatch({
      kind: 'matched',
      fixture: fixture(),
      provider: postponed,
      method: 'canonical_key',
    })
    expect(patch.storeFinal).toBe(false)
    expect(patch.homeScore).toBeNull()
    expect(patch.awayScore).toBeNull()
    expect(patch.resultStatus).toBe('pending')
    expect(patch.status).toBe('postponed')
  })

  it('does not treat in-play scores as final', () => {
    const live = provider({
      status: 'in_play',
      resultStatus: 'pending',
      homeScore: 1,
      awayScore: 0,
      providerStatus: 'IN_PLAY',
    })
    expect(shouldStoreFinalScore(live)).toBe(false)
    const patch = buildResultSyncPatch({
      kind: 'matched',
      fixture: fixture(),
      provider: live,
      method: 'provider_id',
    })
    expect(patch.storeFinal).toBe(false)
    expect(patch.homeScore).toBeNull()
  })

  it('leaves unmatched provider rows for admin review', () => {
    const mapped = mapProviderResultsToFixtures(
      [provider({ canonicalKey: 'nope', providerFixtureId: 'nope', homeTeamId: 'xxx', awayTeamId: 'yyy' })],
      [fixture()],
    )
    expect(mapped[0]?.kind).toBe('unmatched')
  })

  it('matches Sunday scores when stored canonical_key still has Saturday UTC date', () => {
    const sunday = fixture({
      id: 'fx-mun-ips',
      source_fixture_id: null,
      canonical_key: '2026/27|mun|ips|2026-08-29',
      home_team_id: 'mun',
      away_team_id: 'ips',
      kickoff_at: '2026-08-30T15:30:00.000Z',
    })
    const mapped = mapProviderResultToFixture(
      provider({
        providerFixtureId: '560570',
        homeTeamId: 'mun',
        awayTeamId: 'ips',
        kickoffAt: '2026-08-30T15:30:00.000Z',
        canonicalKey: '2026/27|mun|ips|2026-08-30',
        homeScore: 2,
        awayScore: 1,
      }),
      [sunday],
    )
    expect(mapped.kind).toBe('matched')
    if (mapped.kind !== 'matched') return
    expect(mapped.method).toBe('kickoff_teams')
    expect(mapped.fixture.id).toBe('fx-mun-ips')
  })

  it('does not guess when two fixtures share the same home and away pairing', () => {
    const mapped = mapProviderResultToFixture(
      provider({
        providerFixtureId: 'missing',
        canonicalKey: 'nope',
        kickoffAt: '2026-10-01T14:00:00.000Z',
      }),
      [
        fixture({ id: 'a', source_fixture_id: null, canonical_key: 'one' }),
        fixture({ id: 'b', source_fixture_id: null, canonical_key: 'two', kickoff_at: '2026-12-26T15:00:00.000Z' }),
      ],
    )
    expect(mapped.kind).toBe('ambiguous')
  })
})
