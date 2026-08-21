import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  INTRO_SEEN_KEY,
  LANDING_SPLASH_STALL_MS,
  LANDING_SPLASH_VIDEO_SRC,
  createMemorySessionStore,
  decideShowIntro,
  hasSeenIntro,
  markIntroSeen,
  resetIntroDecisionForTests,
  shouldAutoplayLandingVideo,
  shouldShowIntro,
  splashBlocksHomeOrAuth,
  splashVideoClassName,
  splashVideoFitMode,
} from './landingSplash'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = join(__dirname, '..')
const root = join(src, '..')

function read(relativePath: string): string {
  return readFileSync(join(src, relativePath), 'utf8')
}

const splashSource = read('components/LandingSplash.tsx')
const splashLibSource = read('lib/landingSplash.ts')
const cssSource = read('index.css')
const appSource = read('App.tsx')
const homeSource = read('pages/HomePage.tsx')
const authSource = read('contexts/AuthContext.tsx')

afterEach(() => {
  resetIntroDecisionForTests()
})

describe('versioned splash asset and session key', () => {
  it('uses a versioned video path instead of the stale same-name asset', () => {
    expect(LANDING_SPLASH_VIDEO_SRC).toBe('/media/LOS-Landing-video-v3.mp4')
    expect(splashLibSource).toContain('/media/LOS-Landing-video-v3.mp4')
    expect(splashLibSource).not.toContain('/media/LOS-Landing-video.mp4')
    expect(splashSource).toContain('LANDING_SPLASH_VIDEO_SRC')
    expect(splashSource).not.toContain('LOS-Landing-video.mp4')
    expect(existsSync(join(root, 'public', 'media', 'LOS-Landing-video-v3.mp4'))).toBe(true)
    expect(existsSync(join(root, 'public', 'media', 'LOS-Landing-video.mp4'))).toBe(false)
  })

  it('uses a new sessionStorage key so previous viewers can see the replacement once', () => {
    expect(INTRO_SEEN_KEY).toBe('los_intro_seen_v3')
    expect(splashLibSource).toContain('sessionStorage')
    expect(splashLibSource).not.toContain('localStorage')
    expect(splashSource).toContain('data-intro-key={INTRO_SEEN_KEY}')
  })
})

describe('splash session behaviour', () => {
  it('shows splash on first session load', () => {
    const store = createMemorySessionStore()
    expect(hasSeenIntro(store)).toBe(false)
    expect(shouldShowIntro({ seen: false, storageAvailable: true })).toBe(true)
    expect(decideShowIntro(store)).toBe(true)
    expect(hasSeenIntro(store)).toBe(true)
  })

  it('does not replay after a refresh in the same session', () => {
    const store = createMemorySessionStore()
    expect(decideShowIntro(store)).toBe(true)
    resetIntroDecisionForTests()
    expect(decideShowIntro(store)).toBe(false)
    expect(shouldShowIntro({ seen: hasSeenIntro(store), storageAvailable: true })).toBe(false)
  })

  it('does not replay on route navigation', () => {
    const store = createMemorySessionStore()
    expect(decideShowIntro(store)).toBe(true)
    expect(decideShowIntro(store)).toBe(true)
    expect(splashSource).not.toContain('location.pathname')
    expect(appSource.indexOf('<LandingSplash />')).toBeLessThan(appSource.indexOf('<Routes>'))
  })

  it('Skip, ended, and error all dismiss and set the session flag', () => {
    const store = createMemorySessionStore()
    expect(hasSeenIntro(store)).toBe(false)
    markIntroSeen(store)
    expect(hasSeenIntro(store)).toBe(true)
    expect(splashSource).toContain('onClick={dismiss}')
    expect(splashSource).toContain('onEnded={dismiss}')
    expect(splashSource).toContain('onError')
    expect(splashSource).toContain('markIntroSeen')
    expect(splashSource).toContain('Skip')
  })

  it('fails open if sessionStorage is unavailable and does not trap the user', () => {
    expect(shouldShowIntro({ seen: false, storageAvailable: false })).toBe(false)
    expect(hasSeenIntro(null)).toBe(true)
    expect(() => markIntroSeen(null)).not.toThrow()
    expect(decideShowIntro(null)).toBe(false)
  })
})

describe('splash playback and layout', () => {
  it('mutes, plays inline, autoplays, and points at the versioned source', () => {
    expect(splashSource).toContain('autoPlay')
    expect(splashSource).toContain('muted')
    expect(splashSource).toContain('playsInline')
    expect(splashSource).toContain('src={LANDING_SPLASH_VIDEO_SRC}')
    expect(splashSource).toContain('webkit-playsinline')
    expect(splashSource).toContain('LANDING_SPLASH_STALL_MS')
    expect(LANDING_SPLASH_STALL_MS).toBeGreaterThan(0)
  })

  it('bypasses autoplay video for reduced motion and shows a static fallback with Skip', () => {
    expect(shouldAutoplayLandingVideo(true)).toBe(false)
    expect(shouldAutoplayLandingVideo(false)).toBe(true)
    expect(splashSource).toContain('prefers-reduced-motion')
    expect(splashSource).toContain('los-splash-static')
    expect(splashSource).toContain('Skip')
  })

  it('keeps a desktop/landscape contained sizing path', () => {
    expect(splashVideoFitMode(true)).toBe('cover')
    expect(splashVideoFitMode(false)).toBe('contain')
    expect(splashVideoClassName('contain')).toContain('los-splash-video-contain')
    expect(splashVideoClassName('cover')).toContain('los-splash-video-cover')
    expect(cssSource).toContain('los-splash-video-contain')
    expect(cssSource).toContain('object-fit: contain')
    expect(cssSource).toContain('max-height: 100vh')
    expect(cssSource).toContain('orientation: landscape')
    expect(splashSource).toContain('los-splash-overlay-landscape')
  })

  it('does not hide Home or auth behind splash state', () => {
    expect(splashBlocksHomeOrAuth()).toBe(false)
    expect(homeSource).not.toContain('LandingSplash')
    expect(homeSource).not.toContain('hasSeenIntro')
    expect(authSource).not.toContain('LandingSplash')
    expect(appSource).toContain('<LandingSplash />')
    expect(appSource).toContain('<AppShell>')
    expect(appSource).not.toContain('<LandingSplash>')
  })
})
