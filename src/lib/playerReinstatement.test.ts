import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { usedTeamIdsForPlayer } from './pickOptions'
import {
  applyReinstatementState,
  canAdminReinstatePlayer,
  provenWinningPickFromFixture,
  reinstatedPlayerShowsEliminatedBanner,
  REINSTATE_REASON_EXAMPLE,
} from './playerReinstatement'
import { shouldShowEliminatedBanner } from './survivalStatus'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..')
const migration15 = readFileSync(join(root, 'supabase', 'migrations', '15_admin_reinstate_and_round_window.sql'), 'utf8')
const selectionsSource = readFileSync(join(__dirname, 'selections.ts'), 'utf8')
const adminPageSource = readFileSync(join(__dirname, '..', 'pages', 'AdminPage.tsx'), 'utf8')
const correctionsSource = readFileSync(join(__dirname, '..', 'components', 'admin', 'AdminCorrectionsSection.tsx'), 'utf8')

const brightonWin = provenWinningPickFromFixture({
  teamId: 'bha',
  homeTeamId: 'sun',
  awayTeamId: 'bha',
  homeScore: 0,
  awayScore: 2,
  status: 'finished',
  resultStatus: 'final',
})

const eliminatedEntry = {
  id: 'entry-1',
  playerId: 'player-ben',
  gameId: 'game-28',
  status: 'eliminated' as const,
}

const noPickSelection = {
  id: 'sel-1',
  playerId: 'player-ben',
  gameId: 'game-28',
  windowId: 'window-3',
  teamId: null as string | null,
  createdAt: '2026-10-11T20:05:17.855Z',
  outcome: 'no_pick' as const,
  usedFinal: false,
  adminCorrected: false,
  correctionReason: null as string | null,
}

describe('admin player reinstatement', () => {
  it('allows admin to reinstate an eliminated player with a proven winning pick', () => {
    const check = canAdminReinstatePlayer({
      isAdmin: true,
      gameStatus: 'open',
      entryStatus: 'eliminated',
      windowExists: true,
      reason: REINSTATE_REASON_EXAMPLE,
      confirmed: true,
      provenWin: brightonWin,
      confirmWithoutWinningPick: false,
    })
    expect(check.allowed).toBe(true)
    const next = applyReinstatementState({
      entry: eliminatedEntry,
      selection: noPickSelection,
      teamId: 'bha',
      reason: REINSTATE_REASON_EXAMPLE,
      actorPlayerId: 'admin-1',
      nowIso: '2026-10-14T12:00:00.000Z',
      provenWin: brightonWin,
    })
    expect(next.entry.status).toBe('active')
    expect(next.selection?.outcome).toBe('survived')
    expect(next.selection?.usedFinal).toBe(true)
    expect(next.selection?.teamId).toBe('bha')
    expect(next.selection?.createdAt).toBe(noPickSelection.createdAt)
    expect(next.duplicatedEntry).toBe(false)
    expect(next.duplicatedSelection).toBe(false)
  })

  it('requires a reason', () => {
    expect(
      canAdminReinstatePlayer({
        isAdmin: true,
        gameStatus: 'open',
        entryStatus: 'eliminated',
        windowExists: true,
        reason: 'short',
        confirmed: true,
        provenWin: brightonWin,
        confirmWithoutWinningPick: false,
      }).error,
    ).toBe('LATE_REASON_REQUIRED')
  })

  it('blocks non-admins', () => {
    expect(
      canAdminReinstatePlayer({
        isAdmin: false,
        gameStatus: 'open',
        entryStatus: 'eliminated',
        windowExists: true,
        reason: REINSTATE_REASON_EXAMPLE,
        confirmed: true,
        provenWin: brightonWin,
        confirmWithoutWinningPick: false,
      }).error,
    ).toBe('ADMIN_REQUIRED')
  })

  it('is idempotent and does not duplicate entries or picks', () => {
    const first = applyReinstatementState({
      entry: eliminatedEntry,
      selection: { ...noPickSelection, teamId: 'bha', outcome: 'survived', usedFinal: true },
      teamId: 'bha',
      reason: REINSTATE_REASON_EXAMPLE,
      actorPlayerId: 'admin-1',
      nowIso: '2026-10-14T12:00:00.000Z',
      provenWin: brightonWin,
    })
    const second = applyReinstatementState({
      entry: first.entry,
      selection: first.selection,
      teamId: 'bha',
      reason: REINSTATE_REASON_EXAMPLE,
      actorPlayerId: 'admin-1',
      nowIso: '2026-10-14T13:00:00.000Z',
      provenWin: brightonWin,
    })
    expect(first.entry.status).toBe('active')
    expect(second.alreadyReinstated).toBe(true)
    expect(second.duplicatedEntry).toBe(false)
    expect(second.duplicatedSelection).toBe(false)
    expect(second.selection?.id).toBe(first.selection?.id)
  })

  it('removes the eliminated banner after reinstatement', () => {
    expect(reinstatedPlayerShowsEliminatedBanner('eliminated')).toBe(true)
    expect(reinstatedPlayerShowsEliminatedBanner('active')).toBe(false)
    expect(shouldShowEliminatedBanner('active')).toBe(false)
  })

  it('marks the winning team as used so it cannot be picked again in the same game', () => {
    const used = usedTeamIdsForPlayer(
      [{ player_id: 'player-ben', window_id: 'window-3', team_id: 'bha', used_final: true }],
      'player-ben',
      ['window-3'],
    )
    expect(used).toContain('bha')
  })

  it('blocks a player without a proven winning pick unless a stronger warning is confirmed', () => {
    const blocked = canAdminReinstatePlayer({
      isAdmin: true,
      gameStatus: 'open',
      entryStatus: 'eliminated',
      windowExists: true,
      reason: REINSTATE_REASON_EXAMPLE,
      confirmed: true,
      provenWin: null,
      confirmWithoutWinningPick: false,
    })
    expect(blocked.allowed).toBe(false)
    expect(blocked.error).toBe('WINNING_PICK_REQUIRED')
    const unresolved = provenWinningPickFromFixture({
      teamId: 'bha',
      homeTeamId: 'sun',
      awayTeamId: 'bha',
      homeScore: null,
      awayScore: null,
      status: 'scheduled',
      resultStatus: 'pending',
    })
    expect(
      canAdminReinstatePlayer({
        isAdmin: true,
        gameStatus: 'open',
        entryStatus: 'eliminated',
        windowExists: true,
        reason: REINSTATE_REASON_EXAMPLE,
        confirmed: true,
        provenWin: unresolved,
        confirmWithoutWinningPick: false,
      }).error,
    ).toBe('RESULT_NOT_FINAL')
  })

  it('enforces admin-only RPC checks and audit fields in migration 15', () => {
    expect(migration15).toContain('admin_reinstate_player')
    expect(migration15).toContain('if not public.is_admin() then')
    expect(migration15).toContain("perform public.pick_error('LATE_REASON_REQUIRED')")
    expect(migration15).toContain("perform public.pick_error('WINNING_PICK_REQUIRED')")
    expect(migration15).toContain("perform public.pick_error('RESULT_NOT_FINAL')")
    expect(migration15).toContain('on conflict (window_id, player_id) do update')
    expect(migration15).toContain("status = 'active'")
    expect(migration15).toContain("outcome = 'survived'")
    expect(migration15).toContain('used_final = true')
    expect(migration15).toContain('admin_corrected = true')
    expect(migration15).toContain('correction_reason')
    expect(migration15).toContain("action_type,")
    expect(migration15).toContain("'reinstate_player'")
    expect(migration15).toContain('to authenticated')
    expect(migration15).not.toContain('to anon')
    expect(selectionsSource).toContain("client.rpc('admin_reinstate_player'")
    expect(adminPageSource).toContain('AdminCorrectionsSection')
    expect(correctionsSource).toContain('Reinstate player')
    expect(correctionsSource).toContain('REINSTATE_SECTION_COPY')
  })
})
