import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CURRENT_PICKS_MENU_LABEL, buildAppMenuItems, menuIncludesAdmin, menuIncludesPath } from './appNavigation'
import { CURRENT_PICKS_EMPTY_MESSAGE, CURRENT_PICKS_ROUND_OPEN_INTRO, ROUND1_LIVE_DEADLINE_UTC } from './round1'
import { canSubmitPick, isWindowEditable, isWindowLocked } from './selections'
import {
  canSubmitPick as canSubmitOpenWindow,
  canViewCurrentPicks,
  isPlayerFacingOpenWindow,
  MIN_OPERATIONAL_WINDOW_NUMBER,
} from './windowGuards'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = join(__dirname, '..')
const root = join(src, '..')

function read(relativePath: string): string {
  return readFileSync(join(src, relativePath), 'utf8')
}

const currentPicksSource = read('pages/CurrentPicksPage.tsx')
const homeSource = read('pages/HomePage.tsx')
const pickSource = read('pages/PickPage.tsx')
const selectionsSource = read('lib/selections.ts')
const fixtureOpsSource = read('lib/fixtureOps.ts')
const appSource = read('App.tsx')
const navSource = read('lib/appNavigation.ts')
const splashSource = read('components/LandingSplash.tsx')
const authSource = read('contexts/AuthContext.tsx')

const beforeDeadline = new Date('2026-08-21T14:00:00.000Z').getTime()
const afterDeadline = new Date('2026-08-21T16:00:00.000Z').getTime()

const round1Window = {
  window_number: MIN_OPERATIONAL_WINDOW_NUMBER,
  status: 'open' as const,
  deadline_at: ROUND1_LIVE_DEADLINE_UTC,
  snapshot_fixture_count: 8,
}

describe('current picks remain visible after deadline', () => {
  it('shows submitted picks before and after the deadline', () => {
    expect(isPlayerFacingOpenWindow(round1Window, beforeDeadline)).toBe(true)
    expect(canViewCurrentPicks(round1Window)).toBe(true)
    expect(isPlayerFacingOpenWindow(round1Window, afterDeadline)).toBe(false)
    expect(canViewCurrentPicks(round1Window)).toBe(true)
    expect(canViewCurrentPicks({ window_number: 2, status: 'locked' })).toBe(true)
    expect(canViewCurrentPicks({ window_number: 2, status: 'resolving' })).toBe(true)
    expect(canViewCurrentPicks({ window_number: 1, status: 'open' })).toBe(false)
    expect(canViewCurrentPicks(null)).toBe(false)
  })

  it('keeps submit/amend blocked after the deadline without hiding Current Picks', () => {
    const window = {
      id: 'w2',
      game_id: 'g27',
      window_number: 2,
      start_at: '2026-08-21T00:00:00.000Z',
      end_at: '2026-08-23T23:00:00.000Z',
      deadline_at: ROUND1_LIVE_DEADLINE_UTC,
      status: 'open' as const,
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-01T00:00:00.000Z',
    }
    expect(isWindowEditable(window, beforeDeadline)).toBe(true)
    expect(canSubmitPick(window, beforeDeadline)).toBe(true)
    expect(isWindowLocked(window, afterDeadline)).toBe(true)
    expect(isWindowEditable(window, afterDeadline)).toBe(false)
    expect(canSubmitPick(window, afterDeadline)).toBe(false)
    expect(canSubmitOpenWindow(round1Window, afterDeadline)).toBe(false)
    expect(canViewCurrentPicks(window)).toBe(true)
    expect(pickSource).toContain('fetchOpenSelectionWindow')
    expect(pickSource).toContain('isWindowEditable')
    expect(currentPicksSource).not.toContain('fetchOpenSelectionWindow')
  })

  it('loads Current Picks from the operational window, not the submit-open helper', () => {
    expect(selectionsSource).toContain('fetchCurrentOperationalWindow')
    expect(selectionsSource).toContain('getCurrentOperationalWindow')
    expect(selectionsSource).not.toContain('return fetchOpenSelectionWindow')
    expect(fixtureOpsSource).toContain('fetchCurrentOperationalWindow')
    expect(currentPicksSource).toContain('fetchCurrentSelectionWindow')
    expect(currentPicksSource).toContain('canViewCurrentPicks')
    expect(selectionsSource).toContain('public_current_window_picks')
    expect(homeSource).toContain('fetchLatestOperationalWindow')
    expect(homeSource).toContain('buildPickDistribution')
  })

  it('lets guests and ordinary users view picks without making their own pick', () => {
    const playerMenu = buildAppMenuItems({ isAuthenticated: true, isAdmin: false })
    const guestMenu = buildAppMenuItems({ isAuthenticated: false, isAdmin: false })
    expect(menuIncludesPath(playerMenu, '/current-picks')).toBe(true)
    expect(menuIncludesPath(guestMenu, '/current-picks')).toBe(true)
    expect(CURRENT_PICKS_ROUND_OPEN_INTRO.toLowerCase()).toContain('do not need to submit your own pick first')
    expect(currentPicksSource).not.toContain('fetchMySelection')
    expect(currentPicksSource).not.toContain('useAuth')
    expect(playerMenu.find((item) => item.kind === 'link' && item.to === '/current-picks')?.label).toBe(
      CURRENT_PICKS_MENU_LABEL,
    )
  })

  it('does not expose email, phone, payment status, or internal IDs in the Current Picks UI', () => {
    expect(currentPicksSource).not.toContain('row.email')
    expect(currentPicksSource).not.toContain('row.phone')
    expect(currentPicksSource).not.toContain('{row.paid}')
    expect(currentPicksSource).not.toContain('payment')
    expect(currentPicksSource).toContain('display_name')
    expect(currentPicksSource).toContain('team_id')
    expect(currentPicksSource).not.toContain('{row.player_id}</')
    expect(currentPicksSource).not.toContain('>{row.player_id}<')
  })

  it('uses the pre-launch placeholder only when there is no current operational window', () => {
    expect(currentPicksSource).toContain('PUBLIC_PRE_LAUNCH_POINTS[0]')
    expect(currentPicksSource).toContain('!window || !showPicksBoard')
    expect(currentPicksSource).toContain('CURRENT_PICKS_EMPTY_MESSAGE')
    expect(CURRENT_PICKS_EMPTY_MESSAGE).toBe('No picks submitted yet.')
    expect(currentPicksSource).not.toContain('Current picks stay visible while the round is open.')
  })

  it('does not change splash, navigation, or admin-only access', () => {
    const playerMenu = buildAppMenuItems({ isAuthenticated: true, isAdmin: false })
    expect(menuIncludesAdmin(playerMenu)).toBe(false)
    expect(navSource).toContain("to: '/current-picks'")
    expect(appSource).toContain('path="/current-picks"')
    expect(appSource).toContain('<LandingSplash />')
    expect(splashSource).toContain('decideShowIntro')
    expect(homeSource).not.toContain('LandingSplash')
    expect(authSource).not.toContain('LandingSplash')
    expect(existsSync(join(root, 'src', 'pages', 'CurrentPicksPage.tsx'))).toBe(true)
  })
})
