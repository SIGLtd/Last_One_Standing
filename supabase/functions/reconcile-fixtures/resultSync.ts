export type ProviderMatchInput = {
  providerFixtureId: string
  homeTeamId: string
  awayTeamId: string
  kickoffAt: string
  canonicalKey: string
  status: string
  homeScore: number | null
  awayScore: number | null
  resultStatus: string
  providerStatus?: string | null
}

export type AppFixtureInput = {
  id: string
  source_fixture_id: string | null
  canonical_key: string
  home_team_id: string
  away_team_id: string
  kickoff_at: string
  status: string
  home_score: number | null
  away_score: number | null
  result_status: string
}

const NON_FINAL = new Set(['postponed', 'cancelled', 'canceled', 'suspended', 'abandoned'])

export function londonDateFromKickoffUtc(iso: string): string {
  const parsed = Date.parse(iso)
  if (!Number.isFinite(parsed)) return iso.slice(0, 10)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(parsed))
}

export function isProviderResultFinal(provider: ProviderMatchInput): boolean {
  const mapped = provider.status.trim().toLowerCase()
  const raw = (provider.providerStatus ?? '').trim().toLowerCase()
  if (NON_FINAL.has(mapped) || NON_FINAL.has(raw)) return false
  if (mapped !== 'finished' && raw !== 'finished' && raw !== 'awarded') return false
  return provider.homeScore != null && provider.awayScore != null
}

export function mapProviderResultToFixture(
  provider: ProviderMatchInput,
  fixtures: AppFixtureInput[],
):
  | { kind: 'matched'; fixture: AppFixtureInput; method: 'provider_id' | 'canonical_key' | 'kickoff_teams' | 'home_away' }
  | { kind: 'ambiguous'; fixtureIds: string[]; reason: string }
  | { kind: 'unmatched'; reason: string } {
  const providerLondon = londonDateFromKickoffUtc(provider.kickoffAt)
  const byProviderId = provider.providerFixtureId
    ? fixtures.filter((fixture) => fixture.source_fixture_id && fixture.source_fixture_id === provider.providerFixtureId)
    : []
  const byCanonical = fixtures.filter((fixture) => fixture.canonical_key === provider.canonicalKey)
  const byKickoffTeams = fixtures.filter(
    (fixture) =>
      fixture.home_team_id === provider.homeTeamId &&
      fixture.away_team_id === provider.awayTeamId &&
      londonDateFromKickoffUtc(fixture.kickoff_at) === providerLondon,
  )

  if (byProviderId.length > 1) {
    return { kind: 'ambiguous', fixtureIds: byProviderId.map((f) => f.id), reason: 'Multiple fixtures share this provider match ID.' }
  }
  if (byCanonical.length > 1) {
    return { kind: 'ambiguous', fixtureIds: byCanonical.map((f) => f.id), reason: 'Multiple fixtures share this home/away/date key.' }
  }
  if (byKickoffTeams.length > 1) {
    return {
      kind: 'ambiguous',
      fixtureIds: byKickoffTeams.map((f) => f.id),
      reason: 'Multiple fixtures share this home/away/kickoff date.',
    }
  }
  if (byProviderId.length === 1 && byCanonical.length === 1 && byProviderId[0].id !== byCanonical[0].id) {
    return {
      kind: 'ambiguous',
      fixtureIds: [byProviderId[0].id, byCanonical[0].id],
      reason: 'Provider ID and home/away/date key point at different fixtures.',
    }
  }
  if (byProviderId.length === 1) {
    return { kind: 'matched', fixture: byProviderId[0], method: 'provider_id' }
  }
  if (byCanonical.length === 1) {
    return { kind: 'matched', fixture: byCanonical[0], method: 'canonical_key' }
  }
  if (byKickoffTeams.length === 1) {
    return { kind: 'matched', fixture: byKickoffTeams[0], method: 'kickoff_teams' }
  }
  const byHomeAway = fixtures.filter(
    (fixture) => fixture.home_team_id === provider.homeTeamId && fixture.away_team_id === provider.awayTeamId,
  )
  if (byHomeAway.length > 1) {
    return {
      kind: 'ambiguous',
      fixtureIds: byHomeAway.map((fixture) => fixture.id),
      reason: 'Multiple fixtures share this home and away team pairing.',
    }
  }
  if (byHomeAway.length === 1) {
    return { kind: 'matched', fixture: byHomeAway[0], method: 'home_away' }
  }
  return { kind: 'unmatched', reason: 'No fixture matched this provider result.' }
}

export function plainProviderError(status: number): string {
  if (status === 401 || status === 403) return 'football-data.org rejected the server key or competition access.'
  if (status === 429) return 'football-data.org rate limit reached. Try again in a minute.'
  if (status >= 500) return 'football-data.org is unavailable. Try again shortly.'
  if (status === 0) return 'Could not reach football-data.org.'
  return `football-data.org returned HTTP ${status}.`
}
