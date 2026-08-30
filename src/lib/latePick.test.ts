import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { pickErrorLabel } from './pickErrors'
import {
  LATE_PICK_REASON_EXAMPLE,
  LATE_PICK_RESOLVED_MESSAGE,
  LATE_PICK_WARNING,
  adminEntryLabel,
  canAdminSubmitLateSelection,
  getLatePickWindowMode,
  isLatePickReasonValid,
} from './latePick'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..')
const migration4 = readFileSync(join(root, 'supabase', 'migrations', '4_fixture_operations_core.sql'), 'utf8')
const migration7 = readFileSync(join(root, 'supabase', 'migrations', '7_beta_feedback_ops.sql'), 'utf8')
const migration11 = readFileSync(join(root, 'supabase', 'migrations', '11_admin_late_selection.sql'), 'utf8')
const selectionsSource = readFileSync(join(root, 'src', 'lib', 'selections.ts'), 'utf8')
const proxySource = readFileSync(join(root, 'src', 'components', 'admin', 'AdminProxyPicksSection.tsx'), 'utf8')
const adminPageSource = readFileSync(join(root, 'src', 'pages', 'AdminPage.tsx'), 'utf8')
const currentPicksSource = readFileSync(join(root, 'src', 'pages', 'CurrentPicksPage.tsx'), 'utf8')
const myPicksSource = readFileSync(join(root, 'src', 'pages', 'MyPicksPage.tsx'), 'utf8')

const openAfterDeadline = {
  status: 'open',
  deadline_at: '2026-08-28T15:00:00.000Z',
}

describe('normal player deadline path is unchanged', () => {
  it('keeps submit_selection blocked after the deadline', () => {
    expect(migration4).toContain("create or replace function public.submit_selection")
    expect(migration4).toContain("perform public.pick_error('DEADLINE_PASSED')")
    expect(migration4).toMatch(/false,\s*null,\s*null/)
    expect(selectionsSource).toContain("client.rpc('submit_selection'")
    expect(selectionsSource).not.toContain('p_admin_corrected')
    expect(selectionsSource).not.toContain('p_correction_reason')
  })

  it('does not let the player late-override RPC exist on the player path', () => {
    expect(migration4).not.toContain('admin_submit_late_selection')
    expect(selectionsSource).toContain("client.rpc('admin_submit_late_selection'")
    expect(selectionsSource).toContain("client.rpc('submit_selection'")
  })
})

describe('admin late pick override rules', () => {
  it('requires a reason after deadline and blocks non-admins', () => {
    expect(isLatePickReasonValid('')).toBe(false)
    expect(isLatePickReasonValid('   short')).toBe(false)
    expect(isLatePickReasonValid(LATE_PICK_REASON_EXAMPLE)).toBe(true)
    expect(canAdminSubmitLateSelection({ isAdmin: false, windowStatus: 'open', reason: LATE_PICK_REASON_EXAMPLE })).toEqual({
      allowed: false,
      error: 'ADMIN_REQUIRED',
    })
    expect(canAdminSubmitLateSelection({ isAdmin: true, windowStatus: 'open', reason: '' })).toEqual({
      allowed: false,
      error: 'LATE_REASON_REQUIRED',
    })
    expect(canAdminSubmitLateSelection({ isAdmin: true, windowStatus: 'open', reason: LATE_PICK_REASON_EXAMPLE })).toEqual({
      allowed: true,
      error: null,
    })
  })

  it('allows an open or locked window after deadline and blocks resolved rounds', () => {
    const afterDeadline = Date.parse('2026-08-28T15:01:00.000Z')
    const beforeDeadline = Date.parse('2026-08-28T14:59:00.000Z')
    expect(getLatePickWindowMode(openAfterDeadline, afterDeadline)).toBe('late_override')
    expect(getLatePickWindowMode(openAfterDeadline, beforeDeadline)).toBe('proxy')
    expect(getLatePickWindowMode({ status: 'locked', deadline_at: openAfterDeadline.deadline_at }, afterDeadline)).toBe(
      'late_override',
    )
    expect(getLatePickWindowMode({ status: 'resolved', deadline_at: openAfterDeadline.deadline_at }, afterDeadline)).toBe(
      'resolved',
    )
    expect(canAdminSubmitLateSelection({ isAdmin: true, windowStatus: 'resolved', reason: LATE_PICK_REASON_EXAMPLE })).toEqual({
      allowed: false,
      error: 'ROUND_ALREADY_RESOLVED',
    })
    expect(pickErrorLabel('ROUND_ALREADY_RESOLVED')).toBe(LATE_PICK_RESOLVED_MESSAGE)
  })

  it('labels late admin entries without exposing private data', () => {
    expect(
      adminEntryLabel({
        adminCorrected: true,
        submittedAt: '2026-08-28T16:00:00.000Z',
        deadlineAt: '2026-08-28T15:00:00.000Z',
      }),
    ).toBe('Late admin entry')
    expect(
      adminEntryLabel({
        adminCorrected: true,
        submittedAt: '2026-08-28T14:00:00.000Z',
        deadlineAt: '2026-08-28T15:00:00.000Z',
      }),
    ).toBe('Admin entered')
    expect(adminEntryLabel({ adminCorrected: false })).toBeNull()
    expect(currentPicksSource).toContain('adminEntryLabel')
    expect(currentPicksSource).not.toContain('row.email')
    expect(currentPicksSource).not.toContain('row.phone')
    expect(myPicksSource).toContain('row.adminEntryLabel')
    expect(myPicksSource).not.toContain('corrected_by')
    expect(myPicksSource).not.toContain('correction_reason')
  })
})

describe('admin_submit_late_selection RPC', () => {
  it('is admin-only, requires a reason, upserts, and writes audit fields', () => {
    expect(migration11).toContain('create or replace function public.admin_submit_late_selection')
    expect(migration11).toContain('if not public.is_admin() then')
    expect(migration11).toContain("raise exception 'ADMIN_REQUIRED'")
    expect(migration11).toContain("perform public.pick_error('LATE_REASON_REQUIRED')")
    expect(migration11).toContain("perform public.pick_error('ROUND_ALREADY_RESOLVED')")
    expect(migration11).toContain("perform public.pick_error('TEAM_NOT_ELIGIBLE')")
    expect(migration11).toContain("perform public.pick_error('TEAM_ALREADY_USED')")
    expect(migration11).toContain('public.is_team_finally_used')
    expect(migration11).toContain("v_entry.status <> 'active'")
    expect(migration11).toContain('not v_entry.paid')
    expect(migration11).toContain('on conflict (window_id, player_id) do update')
    expect(migration11).toContain('admin_corrected = true')
    expect(migration11).toContain('corrected_by = excluded.corrected_by')
    expect(migration11).toContain('correction_reason = excluded.correction_reason')
    expect(migration11).toContain('grant execute on function public.admin_submit_late_selection')
    expect(migration11).toContain('to authenticated')
    expect(migration11).not.toContain('to anon')
    expect(migration11).not.toContain("perform public.pick_error('DEADLINE_PASSED')")
    expect(migration11).not.toContain("perform public.pick_error('FIXTURE_STARTED')")
    expect(migration11).not.toContain('insert into game_entries')
    expect(migration7).toContain("perform public.pick_error('DEADLINE_PASSED')")
    expect(selectionsSource).toContain("client.rpc('admin_submit_late_selection'")
    expect(selectionsSource).toContain('p_reason: input.reason')
  })

  it('does not weaken the existing admin proxy deadline block', () => {
    expect(migration7).toContain('create or replace function public.admin_submit_selection')
    expect(migration7).toContain('v_now >= v_window.deadline_at')
    expect(migration7).toContain("perform public.pick_error('DEADLINE_PASSED')")
  })
})

describe('admin late pick UI', () => {
  it('shows the late override warning and required reason in Admin', () => {
    expect(proxySource).toContain('Admin late pick override')
    expect(proxySource).toContain('Enter late pick')
    expect(proxySource).toContain('{LATE_PICK_WARNING}')
    expect(proxySource).toContain('{LATE_PICK_REASON_EXAMPLE}')
    expect(proxySource).toContain('{LATE_PICK_RESOLVED_MESSAGE}')
    expect(LATE_PICK_WARNING).toBe('This is a post-deadline admin override. It will be recorded in the audit trail.')
    expect(LATE_PICK_REASON_EXAMPLE).toBe('Accepted by organiser: player had no WiFi before deadline.')
    expect(LATE_PICK_RESOLVED_MESSAGE).toBe(
      'This round has already been resolved. Reopen/correction workflow required.',
    )
    expect(proxySource).toContain('onSaveLatePick')
    expect(adminPageSource).toContain('adminSubmitLateSelection')
    expect(adminPageSource).toContain('handleSaveLatePick')
    expect(adminPageSource).not.toContain('FOOTBALL_DATA_API_KEY')
  })
})
