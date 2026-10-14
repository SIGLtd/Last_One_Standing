import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isDeadlinePassed } from './deadline'
import { formatDeadlineLondon } from './fixtureOps'
import { londonDateTimeLocalToUtcIso } from './londonDeadline'
import { canAdminUpdateRoundWindow, preservePicksAfterDeadlineEdit, ROUND_EDIT_REASON_EXAMPLE } from './roundWindowEdit'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..')
const migration15 = readFileSync(join(root, 'supabase', 'migrations', '15_admin_reinstate_and_round_window.sql'), 'utf8')
const selectionsSource = readFileSync(join(__dirname, 'selections.ts'), 'utf8')
const correctionsSource = readFileSync(join(__dirname, '..', 'components', 'admin', 'AdminCorrectionsSection.tsx'), 'utf8')

const openWindow = {
  isAdmin: true,
  gameStatus: 'open',
  windowStatus: 'open',
  newDeadlineAt: '2026-10-16T15:00:00.000Z',
  currentDeadlineAt: '2026-10-17T10:30:00.000Z',
  earliestKickoffAt: '2026-10-17T11:30:00.000Z',
  pickCount: 16,
  reason: ROUND_EDIT_REASON_EXAMPLE,
  confirmed: true,
  nowMs: Date.parse('2026-10-14T13:00:00.000Z'),
}

describe('admin open round deadline edit', () => {
  it('allows admin to update the deadline on an open round', () => {
    expect(canAdminUpdateRoundWindow(openWindow).allowed).toBe(true)
    expect(formatDeadlineLondon(openWindow.newDeadlineAt).toLowerCase()).toContain('friday')
    expect(formatDeadlineLondon(openWindow.newDeadlineAt)).toContain('16')
  })

  it('requires a reason if picks exist or the deadline has passed', () => {
    expect(canAdminUpdateRoundWindow({ ...openWindow, reason: '' }).error).toBe('LATE_REASON_REQUIRED')
    expect(
      canAdminUpdateRoundWindow({
        ...openWindow,
        pickCount: 0,
        currentDeadlineAt: '2026-10-10T10:30:00.000Z',
        reason: 'short',
      }).error,
    ).toBe('LATE_REASON_REQUIRED')
  })

  it('blocks non-admins, resolved rounds, and completed games', () => {
    expect(canAdminUpdateRoundWindow({ ...openWindow, isAdmin: false }).error).toBe('ADMIN_REQUIRED')
    expect(canAdminUpdateRoundWindow({ ...openWindow, windowStatus: 'resolved' }).error).toBe('ROUND_ALREADY_RESOLVED')
    expect(canAdminUpdateRoundWindow({ ...openWindow, gameStatus: 'complete' }).error).toBe('GAME_COMPLETE')
  })

  it('preserves existing picks and uses the updated deadline for lock behaviour', () => {
    const picks = [{ id: 'p1' }, { id: 'p2' }]
    expect(preservePicksAfterDeadlineEdit(picks)).toEqual(picks)
    expect(isDeadlinePassed(openWindow.currentDeadlineAt, Date.parse('2026-10-16T16:00:00.000Z'))).toBe(false)
    expect(isDeadlinePassed(openWindow.newDeadlineAt, Date.parse('2026-10-16T16:00:00.000Z'))).toBe(true)
    expect(isDeadlinePassed(openWindow.newDeadlineAt, Date.parse('2026-10-16T14:59:00.000Z'))).toBe(false)
  })

  it('blocks a deadline at or after the first kick-off', () => {
    expect(
      canAdminUpdateRoundWindow({
        ...openWindow,
        newDeadlineAt: '2026-10-17T11:30:00.000Z',
      }).error,
    ).toBe('DEADLINE_AFTER_KICKOFF')
  })

  it('stores datetime-local values as Europe/London rather than browser time', () => {
    expect(londonDateTimeLocalToUtcIso('2026-10-16T16:00')).toBe('2026-10-16T15:00:00.000Z')
  })

  it('enforces admin-only RPC checks and an audit trail in migration 15', () => {
    expect(migration15).toContain('admin_update_round_window')
    expect(migration15).toContain('if not public.is_admin() then')
    expect(migration15).toContain("perform public.pick_error('LATE_REASON_REQUIRED')")
    expect(migration15).toContain("perform public.pick_error('ROUND_ALREADY_RESOLVED')")
    expect(migration15).toContain("perform public.pick_error('DEADLINE_AFTER_KICKOFF')")
    expect(migration15).toContain("'update_round_window'")
    expect(migration15).toContain('old_deadline_at')
    expect(migration15).toContain('new_deadline_at')
    expect(migration15).toContain('snapshot_changed')
    expect(migration15).toContain('to authenticated')
    expect(migration15).not.toContain('to anon')
    expect(selectionsSource).toContain("client.rpc('admin_update_round_window'")
    expect(correctionsSource).toContain('Edit current round')
    expect(correctionsSource).not.toContain('from(\'selection_window_eligible_fixtures\').delete')
  })
})
