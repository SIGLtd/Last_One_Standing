import { describe, expect, it } from 'vitest'
import type { SelectableTeamOption } from './fixtureOps'
import {
  filterSelectableTeamOptions,
  finallyUsedWindowIds,
  usedTeamIdsForPlayer,
  type UsedTeamWindow,
} from './pickOptions'

const now = Date.parse('2026-08-20T12:00:00.000Z')

const historicWindow: UsedTeamWindow = {
  id: 'w1',
  window_number: 1,
  status: 'resolved',
  deadline_at: '2026-08-01T15:00:00.000Z',
}

const currentOpenWindow: UsedTeamWindow = {
  id: 'w2',
  window_number: 2,
  status: 'open',
  deadline_at: '2026-08-21T15:00:00.000Z',
}

const priorLockedWindow: UsedTeamWindow = {
  id: 'w2-locked',
  window_number: 2,
  status: 'locked',
  deadline_at: '2026-08-14T15:00:00.000Z',
}

const laterOpenWindow: UsedTeamWindow = {
  id: 'w3',
  window_number: 3,
  status: 'open',
  deadline_at: '2026-08-28T15:00:00.000Z',
}

const eligibleTeams: SelectableTeamOption[] = [
  {
    team_id: 'mun',
    team_name: 'Manchester United',
    opponent_name: 'Hull City',
    venue: 'Away',
    kickoff_at: '2026-08-22T11:30:00.000Z',
    kickoff_london: 'Sat 22 Aug, 12:30',
  },
  {
    team_id: 'liv',
    team_name: 'Liverpool',
    opponent_name: 'Arsenal',
    venue: 'Home',
    kickoff_at: '2026-08-22T14:00:00.000Z',
    kickoff_london: 'Sat 22 Aug, 15:00',
  },
  {
    team_id: 'ars',
    team_name: 'Arsenal',
    opponent_name: 'Liverpool',
    venue: 'Away',
    kickoff_at: '2026-08-22T14:00:00.000Z',
    kickoff_london: 'Sat 22 Aug, 15:00',
  },
]

describe('used-team filtering', () => {
  it('lets a first-round player see all current eligible teams', () => {
    const finalised = finallyUsedWindowIds([historicWindow, currentOpenWindow], now)
    const used = usedTeamIdsForPlayer(
      [{ player_id: 'p1', window_id: 'w2', team_id: null }],
      'p1',
      finalised,
    )

    expect(finalised).toEqual([])
    expect(used).toEqual([])
    expect(filterSelectableTeamOptions(eligibleTeams, used).map((team) => team.team_id)).toEqual([
      'mun',
      'liv',
      'ars',
    ])
  })

  it('hides a team the player finally used in a previous locked round', () => {
    const finalised = finallyUsedWindowIds([priorLockedWindow, laterOpenWindow], now)
    const used = usedTeamIdsForPlayer(
      [{ player_id: 'p1', window_id: 'w2-locked', team_id: 'mun' }],
      'p1',
      finalised,
    )

    expect(used).toEqual(['mun'])
    expect(filterSelectableTeamOptions(eligibleTeams, used).map((team) => team.team_id)).toEqual([
      'liv',
      'ars',
    ])
  })

  it('lets a player amend the current round pick before the deadline', () => {
    const finalised = finallyUsedWindowIds([historicWindow, currentOpenWindow], now)
    const used = usedTeamIdsForPlayer(
      [{ player_id: 'p1', window_id: 'w2', team_id: 'liv' }],
      'p1',
      finalised,
    )

    expect(finalised).not.toContain('w2')
    expect(used).toEqual([])
    expect(filterSelectableTeamOptions(eligibleTeams, used).some((team) => team.team_id === 'liv')).toBe(true)
    expect(filterSelectableTeamOptions(eligibleTeams, used).some((team) => team.team_id === 'mun')).toBe(true)
  })

  it('does not treat a superseded current-round pick as finally used', () => {
    const finalised = finallyUsedWindowIds([currentOpenWindow], now)
    const used = usedTeamIdsForPlayer(
      [{ player_id: 'p1', window_id: 'w2', team_id: 'ars' }],
      'p1',
      finalised,
    )

    expect(used).not.toContain('mun')
    expect(used).not.toContain('ars')
    expect(filterSelectableTeamOptions(eligibleTeams, used).map((team) => team.team_id)).toContain('mun')
  })

  it('does not remove options because other players picked them', () => {
    const finalised = finallyUsedWindowIds([priorLockedWindow, laterOpenWindow], now)
    const used = usedTeamIdsForPlayer(
      [
        { player_id: 'other', window_id: 'w2-locked', team_id: 'liv' },
        { player_id: 'p1', window_id: 'w2-locked', team_id: 'mun' },
      ],
      'p1',
      finalised,
    )

    expect(used).toEqual(['mun'])
    expect(filterSelectableTeamOptions(eligibleTeams, used).map((team) => team.team_id)).toContain('liv')
  })
})
