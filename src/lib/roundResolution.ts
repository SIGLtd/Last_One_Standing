import { TEAM_ID_TO_NAME } from '../config/teams'
import { isDeadlinePassed } from './deadline'
import { snapshotHasNonWeekendFixture } from './weekendFixtures'

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
  window_id?: string | null
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
  safetyIssues: string[]
  previewInconsistent: boolean
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

function isWithdrawnLike(entry: ResolutionEntry): boolean {
  return entry.status === 'withdrawn' || entry.status === 'pending_payment' || (!entry.paid && entry.status !== 'eliminated')
}

function isConsideredForWindow(entry: ResolutionEntry, alreadyResolved: boolean): boolean {
  if (isWithdrawnLike(entry)) return false
  if (!entry.paid) return false
  if (alreadyResolved) return entry.status === 'active' || entry.status === 'eliminated'
  return entry.status === 'active'
}

function storedOutcomeGroup(outcome: SelectionOutcome | null | undefined): SelectionOutcome | null {
  if (outcome === 'survived' || outcome === 'eliminated' || outcome === 'no_pick') return outcome
  return null
}

export function countSubmittedPicksForWindow(
  selections: ResolutionSelection[],
  windowId: string,
): number {
  return selections.filter((selection) => {
    if (selection.window_id && selection.window_id !== windowId) return false
    return Boolean(selection.team_id)
  }).length
}

function cloneState(state: RoundResolutionState): RoundResolutionState {
  return {
    windowStatus: state.windowStatus,
    resolvedAt: state.resolvedAt,
    selections: state.selections.map((selection) => ({ ...selection })),
    entries: state.entries.map((entry) => ({ ...entry })),
  }
}

function statesMatch(left: RoundResolutionState, right: RoundResolutionState): boolean {
  if (left.windowStatus !== right.windowStatus) return false
  if (left.resolvedAt !== right.resolvedAt) return false
  if (left.selections.length !== right.selections.length) return false
  if (left.entries.length !== right.entries.length) return false

  const leftSelections = [...left.selections].sort((a, b) => a.playerId.localeCompare(b.playerId))
  const rightSelections = [...right.selections].sort((a, b) => a.playerId.localeCompare(b.playerId))
  for (let i = 0; i < leftSelections.length; i += 1) {
    const a = leftSelections[i]
    const b = rightSelections[i]
    if (
      a.playerId !== b.playerId ||
      a.teamId !== b.teamId ||
      a.outcome !== b.outcome ||
      a.outcomeReason !== b.outcomeReason ||
      a.usedFinal !== b.usedFinal
    ) {
      return false
    }
  }

  const leftEntries = [...left.entries].sort((a, b) => a.playerId.localeCompare(b.playerId))
  const rightEntries = [...right.entries].sort((a, b) => a.playerId.localeCompare(b.playerId))
  for (let i = 0; i < leftEntries.length; i += 1) {
    const a = leftEntries[i]
    const b = rightEntries[i]
    if (a.playerId !== b.playerId || a.status !== b.status || a.eliminatedReason !== b.eliminatedReason) {
      return false
    }
  }

  return true
}

export function resolveRoundPreview(input: {
  window: RoundResolutionWindow
  fixtures: ResolutionFixture[]
  entries: ResolutionEntry[]
  selections: ResolutionSelection[]
  nowMs?: number
  knownSubmittedPicks?: number
  allowNonWeekendFixtures?: boolean
  eligibilityOverrides?: Record<string, string>
}): RoundResolutionPreview {
  const nowMs = input.nowMs ?? Date.now()
  const deadlinePassed = isDeadlinePassed(input.window.deadline_at, nowMs)
  const alreadyResolved = input.window.status === 'resolved'
  const selectionByPlayer = new Map(
    input.selections
      .filter((selection) => !selection.window_id || selection.window_id === input.window.id)
      .map((selection) => [selection.player_id, selection]),
  )

  const rows: RoundResolutionRow[] = []

  for (const entry of input.entries) {
    const selection = selectionByPlayer.get(entry.player_id) ?? null
    const teamId = selection?.team_id ?? null
    const fixture = fixtureForTeam(input.fixtures, teamId)
    const submittedAt = selection?.updated_at ?? selection?.created_at ?? null
    const fixtureFinal = fixture ? isFixtureFinal(fixture) : false

    if (isWithdrawnLike(entry)) {
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
        fixtureFinal,
      })
      continue
    }

    if (!isConsideredForWindow(entry, alreadyResolved)) {
      continue
    }

    const storedGroup = alreadyResolved ? storedOutcomeGroup(selection?.outcome) : null
    if (storedGroup) {
      const reason = (selection?.outcome_reason as OutcomeReason) ?? (storedGroup === 'no_pick' ? 'no_pick' : null)
      rows.push({
        playerId: entry.player_id,
        displayName: entry.display_name,
        group: storedGroup === 'survived' ? 'survived' : storedGroup === 'eliminated' ? 'eliminated' : 'no_pick',
        teamId,
        teamName: teamId ? teamName(teamId) : storedGroup === 'no_pick' ? '—' : teamName(teamId),
        outcome: storedGroup,
        outcomeReason: reason,
        scoreLabel: storedGroup === 'no_pick' && !teamId ? 'No pick' : scoreLabelForFixture(fixture),
        usedFinal: Boolean(selection?.used_final) || storedGroup !== 'no_pick',
        submittedAt,
        fixtureFinal,
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
        fixtureFinal,
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
  const picksSubmitted = countSubmittedPicksForWindow(input.selections, input.window.id)
  const activeEntrants = liveRows.length

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

  const safetyIssues: string[] = []
  if (input.fixtures.length < 1) {
    safetyIssues.push('Selected window has no eligible fixtures.')
  }
  if (!input.allowNonWeekendFixtures && snapshotHasNonWeekendFixture(input.fixtures, input.eligibilityOverrides)) {
    safetyIssues.push('Selected window includes a non-Saturday/Sunday fixture without an explicit exception.')
  }
  if (pending > activeEntrants) {
    safetyIssues.push('Pending count exceeds active entries considered.')
  }
  if (survived + eliminated + noPicks + pending !== liveRows.length) {
    safetyIssues.push('Preview totals do not match the considered live set.')
  }
  if (picksSubmitted === 0 && (input.knownSubmittedPicks ?? 0) > 0) {
    safetyIssues.push('Selected window shows zero picks but another source still has submitted picks.')
  }

  const previewInconsistent = safetyIssues.length > 0
  let blockedReason: string | null = null
  if (alreadyResolved) {
    blockedReason = 'This round is already resolved.'
  } else if (!deadlinePassed) {
    blockedReason = 'The pick deadline has not passed yet.'
  } else if (pending > 0) {
    blockedReason = 'One or more selected fixtures are not final yet.'
  } else if (previewInconsistent) {
    blockedReason = safetyIssues[0] ?? 'Preview data is internally inconsistent.'
  }

  const readyToResolve =
    !alreadyResolved && deadlinePassed && pending === 0 && !previewInconsistent && input.fixtures.length > 0

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
    safetyIssues,
    previewInconsistent,
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
    return cloneState(state)
  }

  if (!preview.readyToResolve) {
    return cloneState(state)
  }

  return applyRoundCorrection(state, preview, resolvedAt)
}

export function applyRoundCorrection(
  state: RoundResolutionState,
  preview: RoundResolutionPreview,
  resolvedAt: string,
): RoundResolutionState {
  const selectionByPlayer = new Map(state.selections.map((selection) => [selection.playerId, { ...selection }]))
  const entryByPlayer = new Map(state.entries.map((entry) => [entry.playerId, { ...entry }]))

  for (const row of preview.rows) {
    if (row.group === 'withdrawn') continue

    const existing = selectionByPlayer.get(row.playerId)
    selectionByPlayer.set(row.playerId, {
      playerId: row.playerId,
      teamId: existing?.teamId ?? row.teamId,
      outcome: row.outcome,
      outcomeReason: row.outcomeReason,
      usedFinal: row.usedFinal,
    })

    const entry = entryByPlayer.get(row.playerId)
    if (!entry || entry.status === 'withdrawn') continue

    if (row.group === 'survived') {
      entry.status = 'active'
      entry.eliminatedReason = null
    } else if (row.group === 'eliminated' || row.group === 'no_pick') {
      entry.status = 'eliminated'
      entry.eliminatedReason = row.outcomeReason
    }
    entryByPlayer.set(row.playerId, entry)
  }

  const next: RoundResolutionState = {
    windowStatus: 'resolved',
    resolvedAt: state.windowStatus === 'resolved' && state.resolvedAt ? state.resolvedAt : resolvedAt,
    selections: [...selectionByPlayer.values()],
    entries: [...entryByPlayer.values()],
  }

  if (state.windowStatus === 'resolved' && statesMatch(state, next)) {
    return cloneState(state)
  }

  return next
}
