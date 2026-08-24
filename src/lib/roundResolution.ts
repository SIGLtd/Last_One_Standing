import { TEAM_ID_TO_NAME } from '../config/teams'

export type SelectionOutcome = 'survived' | 'eliminated' | 'no_pick' | 'pending'
export type OutcomeReason = 'win' | 'loss' | 'draw' | 'no_pick' | 'unresolved' | 'withdrawn' | null
export type ResolutionGroup = 'survived' | 'eliminated' | 'no_pick' | 'pending' | 'withdrawn'

export type ResolutionFixture = {
  season_fixture_id: string
  home_team_id: string
  away_team_id: string
  home_team_name: string
  away_team_name: string
  kickoff_at: string
  status: string
  home_score: number | null
  away_score: number | null
  result_status: string
}

export type ResolutionEntry = {
  player_id: string
  display_name: string
  status: string
  paid: boolean
}

export type ResolutionSelection = {
  player_id: string
  team_id: string | null
  updated_at?: string | null
  created_at?: string | null
  used_final?: boolean
  outcome?: SelectionOutcome | null
  outcome_reason?: string | null
}

export type RoundResolutionWindow = {
  id: string
  window_number: number
  status: string
  deadline_at: string
}

export type RoundResolutionRow = {
  playerId: string
  displayName: string
  group: ResolutionGroup
  teamId: string | null
  teamName: string
  outcome: SelectionOutcome | null
  outcomeReason: OutcomeReason
  scoreLabel: string
  usedFinal: boolean
  submittedAt: string | null
  fixtureFinal: boolean
}

export type TeamBreakdownRow = {
  teamId: string
  teamName: string
  count: number
  survived: number
  eliminated: number
  pending: number
}

export type RoundResolutionPreview = {
  alreadyResolved: boolean
  readyToResolve: boolean
  blockedReason: string | null
  deadlinePassed: boolean
  activeEntrants: number
  picksSubmitted: number
  noPicks: number
  survived: number
  eliminated: number
  pending: number
  withdrawn: number
  byTeam: TeamBreakdownRow[]
  rows: RoundResolutionRow[]
}

export type RoundResolutionState = {
  windowStatus: string
  resolvedAt: string | null
  selections: Array<{
    playerId: string
    teamId: string | null
    outcome: SelectionOutcome | null
    outcomeReason: string | null
    usedFinal: boolean
  }>
  entries: Array<{
    playerId: string
    status: string
    eliminatedReason: string | null
  }>
}

function teamName(teamId: string | null): string {
  if (!teamId) return '—'
  return TEAM_ID_TO_NAME.get(teamId) ?? teamId
}

export function isFixtureFinal(fixture: Pick<ResolutionFixture, 'status' | 'result_status' | 'home_score' | 'away_score'>): boolean {
  if (fixture.status !== 'finished') return false
  if (fixture.result_status !== 'final') return false
  return fixture.home_score != null && fixture.away_score != null
}

export function scoreLabelForFixture(fixture: ResolutionFixture | null): string {
  if (!fixture) return '—'
  if (fixture.home_score == null || fixture.away_score == null) {
    if (fixture.status === 'postponed') return 'Postponed'
    if (fixture.status === 'cancelled') return 'Cancelled'
    return 'No result yet'
  }
  return `${fixture.home_team_name} ${fixture.home_score}–${fixture.away_score} ${fixture.away_team_name}`
}

export function fixtureForTeam(fixtures: ResolutionFixture[], teamId: string | null): ResolutionFixture | null {
  if (!teamId) return null
  return fixtures.find((fixture) => fixture.home_team_id === teamId || fixture.away_team_id === teamId) ?? null
}

export function mergeEligibleFixturesWithResults(
  snapshots: Array<{
    season_fixture_id: string
    home_team_id: string
    away_team_id: string
    home_team_name: string
    away_team_name: string
    kickoff_at: string
    fixture_status: string
  }>,
  seasonFixtures: Array<{
    id: string
    status: string
    home_score: number | null
    away_score: number | null
    result_status: string
  }>,
): ResolutionFixture[] {
  const byId = new Map(seasonFixtures.map((fixture) => [fixture.id, fixture]))
  return snapshots.map((snapshot) => {
    const master = byId.get(snapshot.season_fixture_id)
    return {
      season_fixture_id: snapshot.season_fixture_id,
      home_team_id: snapshot.home_team_id,
      away_team_id: snapshot.away_team_id,
      home_team_name: snapshot.home_team_name,
      away_team_name: snapshot.away_team_name,
      kickoff_at: snapshot.kickoff_at,
      status: master?.status ?? snapshot.fixture_status,
      home_score: master?.home_score ?? null,
      away_score: master?.away_score ?? null,
      result_status: master?.result_status ?? 'pending',
    }
  })
}

export function outcomeForPickedTeam(
  teamId: string,
  fixture: ResolutionFixture,
): { outcome: SelectionOutcome; reason: OutcomeReason } {
  if (!isFixtureFinal(fixture)) {
    return { outcome: 'pending', reason: 'unresolved' }
  }

  const homeScore = fixture.home_score as number
  const awayScore = fixture.away_score as number

  if (homeScore === awayScore) {
    return { outcome: 'eliminated', reason: 'draw' }
  }

  const pickedWon =
    (teamId === fixture.home_team_id && homeScore > awayScore) ||
    (teamId === fixture.away_team_id && awayScore > homeScore)

  if (pickedWon) return { outcome: 'survived', reason: 'win' }
  return { outcome: 'eliminated', reason: 'loss' }
}

function isLiveEntrant(entry: ResolutionEntry): boolean {
  return entry.paid && entry.status === 'active'
}

export function resolveRoundPreview(input: {
  window: RoundResolutionWindow
  fixtures: ResolutionFixture[]
  entries: ResolutionEntry[]
  selections: ResolutionSelection[]
  nowMs?: number
}): RoundResolutionPreview {
  const nowMs = input.nowMs ?? Date.now()
  const deadlinePassed = nowMs >= new Date(input.window.deadline_at).getTime()
  const alreadyResolved = input.window.status === 'resolved'
  const selectionByPlayer = new Map(input.selections.map((selection) => [selection.player_id, selection]))

  const rows: RoundResolutionRow[] = []

  for (const entry of input.entries) {
    const selection = selectionByPlayer.get(entry.player_id) ?? null
    const teamId = selection?.team_id ?? null
    const fixture = fixtureForTeam(input.fixtures, teamId)
    const submittedAt = selection?.updated_at ?? selection?.created_at ?? null

    if (entry.status === 'withdrawn' || entry.status === 'pending_payment' || (!entry.paid && entry.status !== 'eliminated')) {
      rows.push({
        playerId: entry.player_id,
        displayName: entry.display_name,
        group: 'withdrawn',
        teamId,
        teamName: teamName(teamId),
        outcome: null,
        outcomeReason: 'withdrawn',
        scoreLabel: scoreLabelForFixture(fixture),
        usedFinal: false,
        submittedAt,
        fixtureFinal: fixture ? isFixtureFinal(fixture) : false,
      })
      continue
    }

    if (!teamId) {
      if (!deadlinePassed) {
        rows.push({
          playerId: entry.player_id,
          displayName: entry.display_name,
          group: 'pending',
          teamId: null,
          teamName: '—',
          outcome: 'pending',
          outcomeReason: 'unresolved',
          scoreLabel: 'No pick yet',
          usedFinal: false,
          submittedAt,
          fixtureFinal: false,
        })
        continue
      }

      rows.push({
        playerId: entry.player_id,
        displayName: entry.display_name,
        group: 'no_pick',
        teamId: null,
        teamName: '—',
        outcome: 'no_pick',
        outcomeReason: 'no_pick',
        scoreLabel: 'No pick',
        usedFinal: false,
        submittedAt,
        fixtureFinal: false,
      })
      continue
    }

    if (!fixture || !isFixtureFinal(fixture)) {
      rows.push({
        playerId: entry.player_id,
        displayName: entry.display_name,
        group: 'pending',
        teamId,
        teamName: teamName(teamId),
        outcome: 'pending',
        outcomeReason: 'unresolved',
        scoreLabel: scoreLabelForFixture(fixture),
        usedFinal: false,
        submittedAt,
        fixtureFinal: Boolean(fixture && isFixtureFinal(fixture)),
      })
      continue
    }

    const resolved = outcomeForPickedTeam(teamId, fixture)
    rows.push({
      playerId: entry.player_id,
      displayName: entry.display_name,
      group: resolved.outcome === 'survived' ? 'survived' : 'eliminated',
      teamId,
      teamName: teamName(teamId),
      outcome: resolved.outcome,
      outcomeReason: resolved.reason,
      scoreLabel: scoreLabelForFixture(fixture),
      usedFinal: true,
      submittedAt,
      fixtureFinal: true,
    })
  }

  const liveRows = rows.filter((row) => row.group !== 'withdrawn')
  const survived = liveRows.filter((row) => row.group === 'survived').length
  const eliminated = liveRows.filter((row) => row.group === 'eliminated').length
  const noPicks = liveRows.filter((row) => row.group === 'no_pick').length
  const pending = liveRows.filter((row) => row.group === 'pending').length
  const withdrawn = rows.filter((row) => row.group === 'withdrawn').length
  const picksSubmitted = liveRows.filter((row) => Boolean(row.teamId)).length
  const activeEntrants = input.entries.filter(isLiveEntrant).length

  const byTeamMap = new Map<string, TeamBreakdownRow>()
  for (const row of liveRows) {
    if (!row.teamId) continue
    const current = byTeamMap.get(row.teamId) ?? {
      teamId: row.teamId,
      teamName: row.teamName,
      count: 0,
      survived: 0,
      eliminated: 0,
      pending: 0,
    }
    current.count += 1
    if (row.group === 'survived') current.survived += 1
    if (row.group === 'eliminated') current.eliminated += 1
    if (row.group === 'pending') current.pending += 1
    byTeamMap.set(row.teamId, current)
  }

  let blockedReason: string | null = null
  if (alreadyResolved) {
    blockedReason = 'This round is already resolved.'
  } else if (!deadlinePassed) {
    blockedReason = 'The pick deadline has not passed yet.'
  } else if (pending > 0) {
    blockedReason = 'One or more selected fixtures are not final yet.'
  }

  const readyToResolve = !alreadyResolved && deadlinePassed && pending === 0

  return {
    alreadyResolved,
    readyToResolve,
    blockedReason,
    deadlinePassed,
    activeEntrants,
    picksSubmitted,
    noPicks,
    survived,
    eliminated,
    pending,
    withdrawn,
    byTeam: [...byTeamMap.values()].sort((a, b) => a.teamName.localeCompare(b.teamName)),
    rows: rows.sort((a, b) => a.displayName.localeCompare(b.displayName)),
  }
}

export function applyRoundResolution(
  state: RoundResolutionState,
  preview: RoundResolutionPreview,
  resolvedAt: string,
): RoundResolutionState {
  if (state.windowStatus === 'resolved') {
    return {
      windowStatus: state.windowStatus,
      resolvedAt: state.resolvedAt,
      selections: state.selections.map((selection) => ({ ...selection })),
      entries: state.entries.map((entry) => ({ ...entry })),
    }
  }

  if (!preview.readyToResolve) {
    return {
      windowStatus: state.windowStatus,
      resolvedAt: state.resolvedAt,
      selections: state.selections.map((selection) => ({ ...selection })),
      entries: state.entries.map((entry) => ({ ...entry })),
    }
  }

  const selectionByPlayer = new Map(state.selections.map((selection) => [selection.playerId, { ...selection }]))
  const entryByPlayer = new Map(state.entries.map((entry) => [entry.playerId, { ...entry }]))

  for (const row of preview.rows) {
    if (row.group === 'withdrawn') continue

    const nextSelection = {
      playerId: row.playerId,
      teamId: row.teamId,
      outcome: row.outcome,
      outcomeReason: row.outcomeReason,
      usedFinal: row.usedFinal,
    }
    selectionByPlayer.set(row.playerId, nextSelection)

    const entry = entryByPlayer.get(row.playerId)
    if (!entry || entry.status !== 'active') continue

    if (row.group === 'survived') {
      entry.status = 'active'
      entry.eliminatedReason = null
    } else if (row.group === 'eliminated' || row.group === 'no_pick') {
      entry.status = 'eliminated'
      entry.eliminatedReason = row.outcomeReason
    }
    entryByPlayer.set(row.playerId, entry)
  }

  return {
    windowStatus: 'resolved',
    resolvedAt,
    selections: [...selectionByPlayer.values()],
    entries: [...entryByPlayer.values()],
  }
}
