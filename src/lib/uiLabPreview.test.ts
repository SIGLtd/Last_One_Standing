import { describe, expect, it } from 'vitest'
import type { WindowPickRow } from '../types'
import {
  BRIGHTON_TEAM_ID,
  UI_LAB_DEADLINE_RULE,
  UI_LAB_SCREEN_LABELS,
  adminNextAction,
  buildAdminOverview,
  buildPlayerHomePreview,
  formatRepeatWinnersForPreview,
  groupPicksByTeam,
  historyCardKind,
  pickPreviewCanConfirm,
  pickPreviewCanSubmit,
  rulesPreviewDeadlineLine,
  rulesPreviewSections,
  settlementGateState,
  withReinstatedUsedTeams,
} from './uiLabPreview'

function pickRow(partial: Partial<WindowPickRow> & Pick<WindowPickRow, 'player_id' | 'display_name'>): WindowPickRow {
  return {
    team_id: null,
    locked_at: null,
    entry_status: 'active',
    ...partial,
  }
}

describe('player home preview', () => {
  it('renders a consolidated context anchor for the active state', () => {
    const model = buildPlayerHomePreview({
      persona: 'live',
      gameNumber: 28,
      currentPot: 860,
      roundLabel: 'Round 3',
      deadlineAt: '2026-10-16T15:00:00.000Z',
      liveEntryStatus: 'active',
      gameStatus: 'open',
      hasCurrentPick: false,
      currentPickName: null,
      usedTeamIds: ['che'],
      survivorCount: 22,
    })
    expect(model.gameLabel).toBe('Game 28')
    expect(model.roundLabel).toBe('Round 3')
    expect(model.potLabel).toContain('860')
    expect(model.statusKind).toBe('active')
    expect(model.statusLabel).toBe('Still in')
    expect(model.nextAction).toBe('Make pick')
    expect(model.deadlineRule).toBe(UI_LAB_DEADLINE_RULE)
    expect(model.subtext).toContain('Deadline')
    expect(model.spectator).toBe(false)
  })

  it('renders the eliminated spectator state', () => {
    const model = buildPlayerHomePreview({
      persona: 'eliminated',
      gameNumber: 28,
      currentPot: 860,
      roundLabel: 'Round 3',
      deadlineAt: '2026-10-16T15:00:00.000Z',
      liveEntryStatus: 'eliminated',
      gameStatus: 'open',
      hasCurrentPick: false,
      currentPickName: null,
      usedTeamIds: ['che'],
      survivorCount: 22,
    })
    expect(model.statusKind).toBe('eliminated')
    expect(model.spectator).toBe(true)
    expect(model.nextAction).toContain("everyone's picks")
  })

  it('renders reinstated still-in with Brighton preserved as used', () => {
    const model = buildPlayerHomePreview({
      persona: 'reinstated',
      gameNumber: 28,
      currentPot: 860,
      roundLabel: 'Round 3',
      deadlineAt: '2026-10-16T15:00:00.000Z',
      liveEntryStatus: 'eliminated',
      gameStatus: 'open',
      hasCurrentPick: false,
      currentPickName: null,
      usedTeamIds: ['che'],
      survivorCount: 22,
    })
    expect(model.statusKind).toBe('reinstated')
    expect(model.statusLabel).toBe('Still in (reinstated)')
    expect(model.spectator).toBe(false)
    expect(model.usedTeamIds).toContain(BRIGHTON_TEAM_ID)
    expect(model.usedTeamIds).toContain('che')
    expect(withReinstatedUsedTeams(['che'])).toContain(BRIGHTON_TEAM_ID)
  })

  it('renders the game complete state', () => {
    const model = buildPlayerHomePreview({
      persona: 'complete',
      gameNumber: 27,
      currentPot: 2930,
      roundLabel: 'Round 8',
      deadlineAt: null,
      liveEntryStatus: 'winner',
      gameStatus: 'complete',
      hasCurrentPick: false,
      currentPickName: null,
      usedTeamIds: [],
      survivorCount: 1,
    })
    expect(model.statusKind).toBe('complete')
    expect(model.headline).toContain('complete')
    expect(model.nextAction).toBe('View history')
  })
})

describe('pick preview', () => {
  it('does not confirm until a team is selected', () => {
    expect(pickPreviewCanConfirm({ spectator: false, selectedTeamId: null })).toBe(false)
    expect(pickPreviewCanConfirm({ spectator: false, selectedTeamId: 'bha' })).toBe(true)
  })

  it('never submits a production pick from preview', () => {
    expect(pickPreviewCanSubmit({ spectator: false, selectedTeamId: 'bha' })).toBe(false)
    expect(pickPreviewCanSubmit({ spectator: true, selectedTeamId: 'bha' })).toBe(false)
  })

  it('blocks spectator confirmation', () => {
    expect(pickPreviewCanConfirm({ spectator: true, selectedTeamId: 'bha' })).toBe(false)
  })
})

describe("everyone's picks preview", () => {
  it('groups picks by team with counts and public names only', () => {
    const groups = groupPicksByTeam([
      pickRow({ player_id: '1', display_name: 'Ben', team_id: 'bha' }),
      pickRow({ player_id: '2', display_name: 'Iain', team_id: 'bha' }),
      pickRow({ player_id: '3', display_name: 'Dave', team_id: 'mci' }),
      pickRow({ player_id: '4', display_name: 'Sam', team_id: null }),
    ])
    expect(groups[0]?.teamId).toBe('bha')
    expect(groups[0]?.count).toBe(2)
    expect(groups[0]?.playerNames).toEqual(['Ben', 'Iain'])
    expect(groups).toHaveLength(2)
  })
})

describe('history preview', () => {
  it('distinguishes winner-paid and rollover cards', () => {
    expect(historyCardKind('winner')).toBe('winner-paid')
    expect(historyCardKind('rollover')).toBe('rollover')
    expect(historyCardKind('active')).toBe('in-progress')
    expect(formatRepeatWinnersForPreview('—')).toBe('None')
  })
})

describe('rules preview', () => {
  it('includes the Friday 16:00 and Saturday/Sunday rules', () => {
    const items = rulesPreviewSections().flatMap((section) => section.items)
    expect(rulesPreviewDeadlineLine()).toContain('16:00 on the Friday')
    expect(items.some((item) => item.includes('16:00 on the Friday'))).toBe(true)
    expect(items.some((item) => item.includes('Saturday') && item.includes('Sunday'))).toBe(true)
    expect(items.some((item) => item.includes('organiser-approved correction'))).toBe(true)
    expect(UI_LAB_DEADLINE_RULE).toContain('16:00 UK time')
    expect(items.join(' ')).not.toContain('11:30')
    expect(items.join(' ')).not.toContain('60 minutes')
  })
})

describe('admin preview', () => {
  it('shows next action and keeps settlement gated', () => {
    const overview = buildAdminOverview({
      gameNumber: 28,
      currentPot: 860,
      windowNumber: 4,
      deadlineAt: '2026-10-16T15:00:00.000Z',
      windowStatus: 'open',
      gameStatus: 'open',
      survivorCount: 22,
      picksSubmitted: 16,
      paidActiveCount: 22,
      unpickedCount: 6,
    })
    expect(overview.nextAction).toContain('Wait for picks')
    expect(overview.deadlineRule).toBe(UI_LAB_DEADLINE_RULE)
    expect(overview.warnings.length).toBeGreaterThan(0)
    expect(settlementGateState({ gameStatus: 'open', survivorCount: 22 }).unlocked).toBe(false)
    expect(settlementGateState({ gameStatus: 'open', survivorCount: 22 }).label).toBe('Settlement locked')
    expect(settlementGateState({ gameStatus: 'open', survivorCount: 1 }).unlocked).toBe(true)
    expect(adminNextAction({ gameStatus: 'open', windowStatus: 'open', survivorCount: 22, unpickedCount: 6 })).toContain(
      'Wait for picks',
    )
  })

  it('lists every preview screen', () => {
    expect(UI_LAB_SCREEN_LABELS['player-home']).toBe('Player Home Preview')
    expect(UI_LAB_SCREEN_LABELS['admin-cockpit']).toBe('Admin Cockpit Preview')
  })
})
