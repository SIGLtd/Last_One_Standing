import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { pickErrorLabel } from './pickErrors'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migration4 = readFileSync(join(__dirname, '..', '..', 'supabase', 'migrations', '4_fixture_operations_core.sql'), 'utf8')
const migration6 = readFileSync(join(__dirname, '..', '..', 'supabase', 'migrations', '6_selection_admin_audit_columns.sql'), 'utf8')
const selectionsSource = readFileSync(join(__dirname, 'selections.ts'), 'utf8')

describe('selection save path', () => {
  it('uses submit_selection RPC rather than direct client inserts', () => {
    expect(selectionsSource).toContain("client.rpc('submit_selection'")
    expect(selectionsSource).not.toContain("from('selections').insert")
  })

  it('sets admin_corrected to false for normal player submission in the RPC', () => {
    expect(migration4).toContain('admin_corrected, corrected_by, correction_reason')
    expect(migration4).toMatch(/false,\s*null,\s*null/)
    expect(migration4).toContain('on conflict (window_id, player_id) do update')
  })

  it('adds missing audit columns with safe defaults in migration 6', () => {
    expect(migration6).toContain('admin_corrected boolean not null default false')
    expect(migration6).toContain('corrected_by uuid references players(id)')
    expect(migration6).toContain('correction_reason text')
  })

  it('blocks inactive or unpaid users with ENTRY_INACTIVE messaging', () => {
    expect(migration4).toContain("perform public.pick_error('ENTRY_INACTIVE')")
    expect(pickErrorLabel('ENTRY_INACTIVE')).toContain('Verified active entry')
  })

  it('does not expose admin_corrected in the frontend save payload', () => {
    expect(selectionsSource).not.toContain('admin_corrected')
    expect(selectionsSource).toContain('p_team_id: input.teamId')
  })

  it('returns current window picks from selections for the open round board', () => {
    expect(selectionsSource).toContain('fetchCurrentWindowPicks')
    expect(selectionsSource).toContain(".eq('window_id', windowId)")
  })
})
