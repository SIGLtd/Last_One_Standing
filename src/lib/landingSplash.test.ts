import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, beforeEach } from 'vitest'
import {
  LANDING_SPLASH_VIDEO_SRC,
  isLandingSplashPending,
  markLandingSplashComplete,
  resetLandingSplashForTests,
  shouldAutoplayLandingVideo,
  shouldUseStaticLandingFallback,
} from './landingSplash'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appSource = readFileSync(join(__dirname, '..', 'App.tsx'), 'utf8')
const splashSource = readFileSync(join(__dirname, '..', 'components', 'LandingSplash.tsx'), 'utf8')

describe('landing splash lifecycle', () => {
  beforeEach(() => {
    resetLandingSplashForTests()
  })

  it('starts pending only once per browser page load', () => {
    expect(isLandingSplashPending()).toBe(true)
    markLandingSplashComplete()
    expect(isLandingSplashPending()).toBe(false)
  })

  it('wraps the app shell without replacing router routes', () => {
    expect(appSource).toContain('<LandingSplash>')
    expect(appSource).toContain('<AppShell>')
    expect(appSource).toContain('path="/pick"')
    expect(appSource).toContain('path="/admin"')
  })

  it('does not persist splash state in storage', () => {
    expect(splashSource).not.toContain('localStorage')
    expect(splashSource).not.toContain('sessionStorage')
    expect(splashSource).not.toContain('document.cookie')
  })

  it('reveals the requested route after skip or completion without navigation reset', () => {
    expect(splashSource).toContain('Skip intro')
    expect(splashSource).toContain('onEnded={dismissSplash}')
    expect(splashSource).not.toContain('<Navigate')
    expect(splashSource).toContain('visibility: hidden')
  })

  it('bypasses autoplay for reduced-motion users and on video failure', () => {
    expect(shouldAutoplayLandingVideo(true)).toBe(false)
    expect(shouldAutoplayLandingVideo(false)).toBe(true)
    expect(shouldUseStaticLandingFallback(true, false)).toBe(true)
    expect(shouldUseStaticLandingFallback(false, true)).toBe(true)
    expect(splashSource).toContain('prefers-reduced-motion: reduce')
    expect(splashSource).toContain('onError={dismissSplash}')
  })

  it('uses the deployable mp4 asset with accessible mobile skip control', () => {
    expect(LANDING_SPLASH_VIDEO_SRC).toBe('/media/LOS-Landing-video.mp4')
    expect(splashSource).toContain('playsInline')
    expect(splashSource).toContain('muted')
    expect(splashSource).toContain('los-splash-skip')
    expect(splashSource).toContain('aria-label="Last One Standing intro"')
  })

  it('keeps admin route protection in the app after splash exit', () => {
    expect(appSource).toContain('<Route path="/admin" element={<AdminPage />} />')
    expect(splashSource).not.toContain('is_admin')
  })
})
