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

export type ResultMatchMethod = 'provider_id' | 'canonical_key' | 'home_away' | 'kickoff_teams'

export type MappedProviderResult =
  | {
      kind: 'matched'
      fixture: AppFixtureInput
      provider: ProviderMatchInput
      method: ResultMatchMethod
    }
  | {
      kind: 'ambiguous'
      provider: ProviderMatchInput
      fixtureIds: string[]
      reason: string
    }
  | {
      kind: 'unmatched'
      provider: ProviderMatchInput
      reason: string
    }

const FINAL_PROVIDER_STATUSES = new Set(['finished', 'FINISHED', 'awarded', 'AWARDED'])
const NON_FINAL_PROVIDER_STATUSES = new Set([
  'postponed',
  'POSTPONED',
  'cancelled',
  'CANCELLED',
  'canceled',
  'CANCELED',
  'suspended',
  'SUSPENDED',
  'abandoned',
  'ABANDONED',
])

export function isProviderStatusClearlyFinal(status: string, providerStatus?: string | null): boolean {
  const mapped = status.trim().toLowerCase()
  const raw = (providerStatus ?? '').trim().toUpperCase()
  if (NON_FINAL_PROVIDER_STATUSES.has(status) || NON_FINAL_PROVIDER_STATUSES.has(raw)) return false
  return mapped === 'finished' || FINAL_PROVIDER_STATUSES.has(raw)
}

export function isProviderResultFinal(provider: ProviderMatchInput): boolean {
  if (!isProviderStatusClearlyFinal(provider.status, provider.providerStatus)) return false
  if (provider.homeScore == null || provider.awayScore == null) return false
  if (provider.resultStatus && provider.resultStatus !== 'final' && provider.resultStatus !== 'pending') {
    return provider.resultStatus === 'final'
  }
  return true
}

export function shouldStoreFinalScore(provider: ProviderMatchInput): boolean {
  return isProviderResultFinal(provider)
}

export function isProviderFixtureUnresolved(provider: ProviderMatchInput): boolean {
  if (shouldStoreFinalScore(provider)) return false
  const mapped = provider.status.trim().toLowerCase()
  const raw = (provider.providerStatus ?? '').trim().toUpperCase()
  return (
    mapped === 'postponed' ||
    mapped === 'cancelled' ||
    mapped === 'suspended' ||
    raw === 'POSTPONED' ||
    raw === 'CANCELLED' ||
    raw === 'SUSPENDED' ||
    raw === 'ABANDONED' ||
    mapped === 'in_play' ||
    mapped === 'scheduled' ||
    provider.homeScore == null ||
    provider.awayScore == null
  )
}

function uniqueById(fixtures: AppFixtureInput[]): AppFixtureInput[] {
  const seen = new Set<string>()
  const out: AppFixtureInput[] = []
  for (const fixture of fixtures) {
    if (seen.has(fixture.id)) continue
    seen.add(fixture.id)
    out.push(fixture)
  }
  return out
}

/** London calendar date for a stored UTC kickoff. Avoids stale canonical_key dates. */
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

export function mapProviderResultToFixture(
  provider: ProviderMatchInput,
  fixtures: AppFixtureInput[],
): MappedProviderResult {
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
    return {
      kind: 'ambiguous',
      provider,
      fixtureIds: uniqueById(byProviderId).map((fixture) => fixture.id),
      reason: 'Multiple fixtures share this provider match ID.',
    }
  }

  if (byCanonical.length > 1) {
    return {
      kind: 'ambiguous',
      provider,
      fixtureIds: uniqueById(byCanonical).map((fixture) => fixture.id),
      reason: 'Multiple fixtures share this home/away/date key.',
    }
  }

  if (byKickoffTeams.length > 1) {
    return {
      kind: 'ambiguous',
      provider,
      fixtureIds: uniqueById(byKickoffTeams).map((fixture) => fixture.id),
      reason: 'Multiple fixtures share this home/away/kickoff date.',
    }
  }

  if (byProviderId.length === 1 && byCanonical.length === 1 && byProviderId[0].id !== byCanonical[0].id) {
    return {
      kind: 'ambiguous',
      provider,
      fixtureIds: [byProviderId[0].id, byCanonical[0].id],
      reason: 'Provider ID and home/away/date key point at different fixtures.',
    }
  }

  if (byProviderId.length === 1) {
    return { kind: 'matched', fixture: byProviderId[0], provider, method: 'provider_id' }
  }

  if (byCanonical.length === 1) {
    return { kind: 'matched', fixture: byCanonical[0], provider, method: 'canonical_key' }
  }

  if (byKickoffTeams.length === 1) {
    return { kind: 'matched', fixture: byKickoffTeams[0], provider, method: 'kickoff_teams' }
  }

  const byHomeAway = fixtures.filter(
    (fixture) => fixture.home_team_id === provider.homeTeamId && fixture.away_team_id === provider.awayTeamId,
  )
  if (byHomeAway.length > 1) {
    return {
      kind: 'ambiguous',
      provider,
      fixtureIds: uniqueById(byHomeAway).map((fixture) => fixture.id),
      reason: 'Multiple fixtures share this home and away team pairing.',
    }
  }
  if (byHomeAway.length === 1) {
    return { kind: 'matched', fixture: byHomeAway[0], provider, method: 'home_away' }
  }

  return {
    kind: 'unmatched',
    provider,
    reason: 'No fixture matched this provider result.',
  }
}

export function mapProviderResultsToFixtures(
  providers: ProviderMatchInput[],
  fixtures: AppFixtureInput[],
): MappedProviderResult[] {
  return providers.map((provider) => mapProviderResultToFixture(provider, fixtures))
}

export type ResultSyncPatch = {
  fixtureId: string
  method: ResultMatchMethod
  status: string
  homeScore: number | null
  awayScore: number | null
  resultStatus: string
  resultSource: 'football_data'
  providerStatus: string | null
  storeFinal: boolean
}

export function buildResultSyncPatch(mapped: Extract<MappedProviderResult, { kind: 'matched' }>): ResultSyncPatch {
  const storeFinal = shouldStoreFinalScore(mapped.provider)
  const mappedStatus = mapped.provider.status.trim().toLowerCase()
  const safeStatus =
    mappedStatus === 'finished' ||
    mappedStatus === 'scheduled' ||
    mappedStatus === 'in_play' ||
    mappedStatus === 'postponed' ||
    mappedStatus === 'cancelled'
      ? mappedStatus
      : mapped.fixture.status

  return {
    fixtureId: mapped.fixture.id,
    method: mapped.method,
    status: storeFinal ? 'finished' : safeStatus,
    homeScore: storeFinal ? mapped.provider.homeScore : mapped.fixture.home_score,
    awayScore: storeFinal ? mapped.provider.awayScore : mapped.fixture.away_score,
    resultStatus: storeFinal ? 'final' : mapped.fixture.result_status === 'final' ? 'final' : 'pending',
    resultSource: 'football_data',
    providerStatus: mapped.provider.providerStatus ?? mapped.provider.status,
    storeFinal,
  }
}
