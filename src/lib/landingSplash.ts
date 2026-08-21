export const LANDING_SPLASH_VIDEO_SRC = '/media/LOS-Landing-video.mp4'
export const LANDING_SPLASH_POSTER_SRC = '/LOS_Logo.png'
export const INTRO_SEEN_KEY = 'los_intro_seen_v2'
export const LANDING_SPLASH_MAX_MS = 10000
export const LANDING_SPLASH_REDUCED_MOTION_MS = 900

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
