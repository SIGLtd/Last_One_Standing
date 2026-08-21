import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CURRENT_PICKS_MENU_LABEL, buildAppMenuItems, menuIncludesAdmin, menuIncludesPath } from './appNavigation'
import {
  INTRO_SEEN_KEY,
  hasSeenIntro,
  markIntroSeen,
  shouldAutoplayLandingVideo,
  shouldShowIntro,
  splashBlocksHomeOrAuth,
} from './landingSplash'
import { CURRENT_PICKS_ROUND_OPEN_INTRO, CURRENT_PICKS_VISIBLE_WHILE_OPEN } from './round1'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = join(__dirname, '..')
const root = join(src, '..')

function read(relativePath: string): string {
  return readFileSync(join(src, relativePath), 'utf8')
}

const teamChipSource = read('components/TeamChip.tsx')
const fixtureRowSource = read('components/FixtureMatchRow.tsx')
const distributionRowSource = read('components/PickDistributionRowView.tsx')
const splashSource = read('components/LandingSplash.tsx')
const splashLibSource = read('lib/landingSplash.ts')
const appSource = read('App.tsx')
const homeSource = read('pages/HomePage.tsx')
const pickSource = read('pages/PickPage.tsx')
const currentPicksSource = read('pages/CurrentPicksPage.tsx')
const authSource = read('contexts/AuthContext.tsx')
const navSource = read('lib/appNavigation.ts')

describe('shirt icons', () => {
  it('renders an inline SVG shirt instead of a circle initials chip', () => {
    expect(teamChipSource).toContain('<svg')
    expect(teamChipSource).toContain('viewBox="0 0 48 48"')
    expect(teamChipSource).toContain('SHORTS_D')
    expect(teamChipSource).toContain('lg: 38')
    expect(teamChipSource).not.toContain('>10<')
    expect(teamChipSource).not.toContain('showNumber')
    expect(teamChipSource).not.toContain('feDropShadow')
    expect(teamChipSource).not.toContain('{identity.initials}')
    expect(teamChipSource).not.toContain('border-radius: 999px')
    expect(teamChipSource).not.toContain('flaticon')
    expect(teamChipSource).not.toContain('http')
    expect(teamChipSource).not.toContain('badge')
    expect(teamChipSource).not.toContain('<img')
  })

  it('uses an accessible team-name label and unknown fallback colours', () => {
    expect(teamChipSource).toContain('role="img"')
    expect(teamChipSource).toContain('`${fullName} colours`')
    expect(teamChipSource).toContain('getTeamIdentity')
  })

  it('keeps fixture order as shirt, team, vs, team, shirt', () => {
    const rowSource = fixtureRowSource.slice(fixtureRowSource.indexOf('los-match-row'))
    const homeChip = rowSource.indexOf('teamId={fixture.home_team_id}')
    const homeName = rowSource.lastIndexOf('{fixture.home_team_name}')
    const vs = rowSource.indexOf('los-match-vs')
    const awayName = rowSource.lastIndexOf('{fixture.away_team_name}')
    const awayChip = rowSource.indexOf('teamId={fixture.away_team_id}')
    expect(homeChip).toBeGreaterThan(-1)
    expect(homeName).toBeGreaterThan(homeChip)
    expect(vs).toBeGreaterThan(homeName)
    expect(awayName).toBeGreaterThan(vs)
    expect(awayChip).toBeGreaterThan(awayName)
  })

  it('keeps distribution name, count, percentage and bar', () => {
    expect(distributionRowSource).toContain('los-dist-copy')
    expect(distributionRowSource).toContain('los-dist-stat')
    expect(distributionRowSource).toContain('los-dist-name')
    expect(distributionRowSource).toContain('los-dist-count')
    expect(distributionRowSource).toContain('los-dist-pct')
    expect(distributionRowSource).toContain('los-pick-bar')
    expect(distributionRowSource).toContain('size="lg"')
    expect(distributionRowSource).not.toContain('los-dist-head')
    expect(distributionRowSource).not.toContain('los-dist-meta')
    expect(distributionRowSource).toContain('TeamChip')
  })
})

describe('current picks access', () => {
  it('shows Current Picks to ordinary users and guests', () => {
    const playerMenu = buildAppMenuItems({ isAuthenticated: true, isAdmin: false })
    const guestMenu = buildAppMenuItems({ isAuthenticated: false, isAdmin: false })
    expect(CURRENT_PICKS_MENU_LABEL).toBe("See everyone's picks")
    expect(menuIncludesPath(playerMenu, '/current-picks')).toBe(true)
    expect(menuIncludesPath(guestMenu, '/current-picks')).toBe(true)
    expect(playerMenu.find((item) => item.kind === 'link' && item.to === '/current-picks')?.label).toBe(
      CURRENT_PICKS_MENU_LABEL,
    )
    expect(menuIncludesAdmin(playerMenu)).toBe(false)
    expect(navSource).toContain("to: '/current-picks'")
    expect(appSource).toContain('path="/current-picks"')
    expect(homeSource).toContain('See everyone\'s picks')
  })

  it('does not require the viewer to have picked and does not expose private fields', () => {
    expect(CURRENT_PICKS_ROUND_OPEN_INTRO.toLowerCase()).toContain('do not need to submit your own pick first')
    expect(CURRENT_PICKS_VISIBLE_WHILE_OPEN).toBe(true)
    expect(currentPicksSource).toContain('CURRENT_PICKS_VISIBLE_WHILE_OPEN')
    expect(currentPicksSource).not.toContain('row.email')
    expect(currentPicksSource).not.toContain('row.phone')
    expect(currentPicksSource).not.toContain('{row.paid}')
    expect(currentPicksSource).not.toContain('payment')
  })
})

describe('session splash', () => {
  it('shows splash on first session load and suppresses it after the session flag', () => {
    expect(INTRO_SEEN_KEY).toBe('los_intro_seen_v2')
    expect(shouldShowIntro({ seen: false, storageAvailable: true })).toBe(true)
    expect(shouldShowIntro({ seen: true, storageAvailable: true })).toBe(false)
    expect(splashSource).toContain('decideShowIntro')
    expect(appSource).toContain('<LandingSplash />')
    expect(appSource).toContain('<AppShell>')
    expect(splashSource).toContain('LANDING_SPLASH_VIDEO_SRC')
    expect(splashLibSource).toContain('LOS-Landing-video.mp4')
    expect(splashSource).toContain('Skip')
    expect(splashSource).toContain('onEnded={dismiss}')
    expect(splashSource).toContain('onError={dismiss}')
    expect(existsSync(join(root, 'public', 'media', 'LOS-Landing-video.mp4'))).toBe(true)
  })

  it('does not replay on refresh or route changes once the session flag is set', () => {
    const store = new Map<string, string>()
    const fakeStore = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    }
    expect(hasSeenIntro(fakeStore)).toBe(false)
    markIntroSeen(fakeStore)
    expect(hasSeenIntro(fakeStore)).toBe(true)
    expect(shouldShowIntro({ seen: hasSeenIntro(fakeStore), storageAvailable: true })).toBe(false)
    expect(splashLibSource).toContain('sessionStorage')
    expect(splashLibSource).not.toContain('localStorage')
    expect(splashSource).not.toContain('location.pathname')
    expect(appSource.indexOf('<LandingSplash />')).toBeLessThan(appSource.indexOf('<Routes>'))
  })

  it('fails open if storage is unavailable and does not trap the user', () => {
    expect(shouldShowIntro({ seen: false, storageAvailable: false })).toBe(false)
    expect(hasSeenIntro(null)).toBe(true)
    expect(() => markIntroSeen(null)).not.toThrow()
  })

  it('does not autoplay for reduced motion and does not block Home or auth', () => {
    expect(shouldAutoplayLandingVideo(true)).toBe(false)
    expect(shouldAutoplayLandingVideo(false)).toBe(true)
    expect(splashBlocksHomeOrAuth()).toBe(false)
    expect(splashSource).toContain('prefers-reduced-motion')
    expect(homeSource).not.toContain('LandingSplash')
    expect(homeSource).not.toContain('hasSeenIntro')
    expect(authSource).not.toContain('LandingSplash')
    expect(authSource).not.toContain('hasSeenIntro')
    expect(appSource).not.toContain('LandingSplash>')
    expect(pickSource).toContain('TeamChip')
  })
})
