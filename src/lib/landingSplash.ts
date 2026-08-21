export const LANDING_SPLASH_VIDEO_SRC = '/media/LOS-Landing-video-v3.mp4'
export const LANDING_SPLASH_POSTER_SRC = '/LOS_Logo.png'
export const INTRO_SEEN_KEY = 'los_intro_seen_v3'
export const LANDING_SPLASH_MAX_MS = 14000
export const LANDING_SPLASH_REDUCED_MOTION_MS = 900
export const LANDING_SPLASH_STALL_MS = 4500
export const SPLASH_COVER_MEDIA_QUERY = '(orientation: portrait) and (max-width: 700px)'

type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

let pageLoadDecision: boolean | null = null

function getSessionStore(): StorageLike | null {
  try {
    if (typeof sessionStorage === 'undefined') return null
    const probe = '__los_intro_probe__'
    sessionStorage.setItem(probe, '1')
    sessionStorage.removeItem(probe)
    return sessionStorage
  } catch {
    return null
  }
}

export function hasSeenIntro(store: StorageLike | null = getSessionStore()): boolean {
  if (!store) return true
  try {
    return store.getItem(INTRO_SEEN_KEY) === '1'
  } catch {
    return true
  }
}

export function markIntroSeen(store: StorageLike | null = getSessionStore()): void {
  if (!store) return
  try {
    store.setItem(INTRO_SEEN_KEY, '1')
  } catch {
    /* fail open: never trap the user */
  }
}

export function shouldShowIntro(input: { seen: boolean; storageAvailable: boolean }): boolean {
  if (!input.storageAvailable) return false
  return !input.seen
}

export function decideShowIntro(store: StorageLike | null = getSessionStore()): boolean {
  if (pageLoadDecision != null) return pageLoadDecision
  const storageAvailable = store !== null
  const show = shouldShowIntro({ seen: hasSeenIntro(store), storageAvailable })
  if (show) markIntroSeen(store)
  pageLoadDecision = show
  return show
}

export function resetIntroDecisionForTests(): void {
  pageLoadDecision = null
}

export function isIntroStorageAvailable(): boolean {
  return getSessionStore() !== null
}

export function shouldAutoplayLandingVideo(prefersReducedMotion: boolean): boolean {
  return !prefersReducedMotion
}

export function splashBlocksHomeOrAuth(): boolean {
  return false
}

export function splashVideoFitMode(isNarrowPortrait: boolean): 'cover' | 'contain' {
  return isNarrowPortrait ? 'cover' : 'contain'
}

export function splashVideoClassName(fitMode: 'cover' | 'contain'): string {
  return fitMode === 'cover' ? 'los-splash-video los-splash-video-cover' : 'los-splash-video los-splash-video-contain'
}

export function logSplashIssue(message: string): void {
  if (typeof console === 'undefined' || typeof import.meta === 'undefined') return
  if (import.meta.env?.DEV) {
    console.debug(`[LOS splash] ${message}`)
  }
}

export function createMemorySessionStore(initial: Record<string, string> = {}): StorageLike {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
  }
}
