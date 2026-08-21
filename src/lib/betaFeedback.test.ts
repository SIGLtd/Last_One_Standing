import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { formatDeadlineLondon } from './fixtureOps'
import { ROUND1_DEADLINE_PLAYER_LABEL, ROUND1_LIVE_DEADLINE_UTC } from './round1'
import { isWindowEditable, isWindowLocked } from './selections'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..')
const appSource = readFileSync(join(root, 'src', 'App.tsx'), 'utf8')
const cssSource = readFileSync(join(root, 'src', 'index.css'), 'utf8')
const authSource = readFileSync(join(root, 'src', 'contexts', 'AuthContext.tsx'), 'utf8')
const adminSource = readFileSync(join(root, 'src', 'pages', 'AdminPage.tsx'), 'utf8')
const migration7 = readFileSync(join(root, 'supabase', 'migrations', '7_beta_feedback_ops.sql'), 'utf8')
const gameEntriesSource = readFileSync(join(root, 'src', 'lib', 'gameEntries.ts'), 'utf8')
const appNavSource = readFileSync(join(root, 'src', 'lib', 'appNavigation.ts'), 'utf8')

describe('intro splash removal', () => {
  it('does not wrap routes in a splash or hide the shell', () => {
    expect(appSource).not.toContain('LandingSplash')
    expect(appSource).toContain('<AppShell>')
    expect(cssSource).not.toContain('los-splash')
    expect(existsSync(join(root, 'src', 'components', 'LandingSplash.tsx'))).toBe(false)
    expect(existsSync(join(root, 'public', 'media', 'LOS-Landing-video.mp4'))).toBe(false)
  })
})

describe('round 1 live deadline', () => {
  it('stores Friday 21 August 2026 16:00 BST as 15:00 UTC', () => {
    expect(ROUND1_LIVE_DEADLINE_UTC).toBe('2026-08-21T15:00:00.000Z')
    expect(migration7).toContain("timestamptz '2026-08-21 15:00:00+00'")
    expect(migration7).toContain('sw.window_number = 2')
    expect(migration7).not.toContain('window_number = 1')
  })

  it('displays 4:00pm Friday 21 August in UK/BST terms', () => {
    expect(formatDeadlineLondon(ROUND1_LIVE_DEADLINE_UTC).toLowerCase()).toContain('4:00pm')
    expect(formatDeadlineLondon(ROUND1_LIVE_DEADLINE_UTC)).toContain('Friday')
    expect(formatDeadlineLondon(ROUND1_LIVE_DEADLINE_UTC)).toContain('21')
    expect(formatDeadlineLondon(ROUND1_LIVE_DEADLINE_UTC)).toContain('August')
    expect(ROUND1_DEADLINE_PLAYER_LABEL).toBe('4:00pm Friday 21 August')
  })

  it('enforces the updated deadline for pick edits', () => {
    const window = {
      id: 'w2',
      game_id: 'g1',
      window_number: 2,
      start_at: '2026-08-20T00:00:00.000Z',
      end_at: '2026-08-24T00:00:00.000Z',
      deadline_at: ROUND1_LIVE_DEADLINE_UTC,
      status: 'open' as const,
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-01T00:00:00.000Z',
    }
    const beforeDeadline = Date.parse('2026-08-21T14:59:00.000Z')
    const afterDeadline = Date.parse('2026-08-21T15:00:00.000Z')
    expect(isWindowEditable(window, beforeDeadline)).toBe(true)
    expect(isWindowLocked(window, afterDeadline)).toBe(true)
    expect(migration7).toContain('v_now >= v_window.deadline_at')
  })
})

describe('admin proxy picks', () => {
  it('blocks non-admins and upserts one current pick with audit fields', () => {
    expect(migration7).toContain('if not public.is_admin() then')
    expect(migration7).toContain('admin_submit_selection')
    expect(migration7).toContain('on conflict (window_id, player_id) do update')
    expect(migration7).toContain("correction_reason = excluded.correction_reason")
    expect(migration7).toContain("Entered by admin on behalf of player")
    expect(migration7).toContain('admin_corrected = true')
  })
})

describe('login path', () => {
  it('does not wait for admin or payment lists during session restore', () => {
    expect(authSource).toContain("event === 'INITIAL_SESSION'")
    expect(authSource).toContain('loading_profile')
    expect(authSource).not.toContain('adminFetchGameEntries')
    expect(authSource).not.toContain('adminFetchPlayers')
    expect(authSource).toContain('Signing you in')
    expect(authSource).toContain('Loading your player profile')
    expect(adminSource).toContain('Loading admin data')
    expect(gameEntriesSource).toContain("const entryType: EntryType = 'existing'")
  })
})

describe('my pick history navigation', () => {
  it('exposes My Picks behind the app menu', () => {
    expect(appNavSource).toContain("to: '/my-picks', label: 'My Picks'")
    expect(appSource).toContain('path="/my-picks"')
  })
})

describe('pot override', () => {
  it('updates games.current_pot through an admin-only RPC', () => {
    expect(migration7).toContain('admin_update_game_pot')
    expect(gameEntriesSource).toContain('admin_update_game_pot')
    expect(adminSource).toContain('onSavePot')
  })
})
