export const LANDING_SPLASH_VIDEO_SRC = '/media/LOS-Landing-video.mp4'
export const LANDING_SPLASH_POSTER_SRC = '/LOS_Logo.png'
export const LANDING_SPLASH_FADE_MS = 450
export const LANDING_SPLASH_STALL_MS = 4000
export const LANDING_SPLASH_REDUCED_MOTION_MS = 900

let splashPendingForPageLoad = true

export function isLandingSplashPending(): boolean {
  return splashPendingForPageLoad
}

export function markLandingSplashComplete(): void {
  splashPendingForPageLoad = false
}

export function resetLandingSplashForTests(): void {
  splashPendingForPageLoad = true
}

export function shouldAutoplayLandingVideo(prefersReducedMotion: boolean): boolean {
  return !prefersReducedMotion
}

export function shouldUseStaticLandingFallback(prefersReducedMotion: boolean, videoUnavailable: boolean): boolean {
  return prefersReducedMotion || videoUnavailable
}
