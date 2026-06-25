import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppLogo } from './AppLogo'
import {
  LANDING_SPLASH_FADE_MS,
  LANDING_SPLASH_POSTER_SRC,
  LANDING_SPLASH_REDUCED_MOTION_MS,
  LANDING_SPLASH_STALL_MS,
  LANDING_SPLASH_VIDEO_SRC,
  isLandingSplashPending,
  markLandingSplashComplete,
  shouldAutoplayLandingVideo,
} from '../lib/landingSplash'

type SplashPhase = 'playing' | 'fading' | 'done'

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  return prefersReducedMotion
}

type LandingSplashProps = {
  children: ReactNode
}

export function LandingSplash({ children }: LandingSplashProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [phase, setPhase] = useState<SplashPhase>(() => (isLandingSplashPending() ? 'playing' : 'done'))
  const videoRef = useRef<HTMLVideoElement>(null)
  const dismissStartedRef = useRef(false)
  const videoStartedRef = useRef(false)

  const dismissSplash = useCallback(() => {
    if (dismissStartedRef.current) return
    dismissStartedRef.current = true
    markLandingSplashComplete()
    setPhase('fading')
    window.setTimeout(() => setPhase('done'), LANDING_SPLASH_FADE_MS)
  }, [])

  useEffect(() => {
    if (phase !== 'playing') return

    if (prefersReducedMotion) {
      const timer = window.setTimeout(() => dismissSplash(), LANDING_SPLASH_REDUCED_MOTION_MS)
      return () => window.clearTimeout(timer)
    }

    const stallTimer = window.setTimeout(() => {
      if (!videoStartedRef.current) dismissSplash()
    }, LANDING_SPLASH_STALL_MS)

    return () => window.clearTimeout(stallTimer)
  }, [dismissSplash, phase, prefersReducedMotion])

  useEffect(() => {
    if (phase !== 'playing' || prefersReducedMotion) return

    const video = videoRef.current
    if (!video) return

    void video.play().catch(() => {
      dismissSplash()
    })
  }, [dismissSplash, phase, prefersReducedMotion])

  function handleVideoPlaying() {
    videoStartedRef.current = true
  }

  const autoplayVideo = shouldAutoplayLandingVideo(prefersReducedMotion)

  return (
    <>
      <div className={phase === 'done' ? undefined : 'los-splash-app-shell'} aria-hidden={phase !== 'done'}>
        {children}
      </div>

      {phase !== 'done' ? (
        <div
          className={['los-splash-overlay', phase === 'fading' ? 'los-splash-overlay--fading' : ''].join(' ')}
          role="dialog"
          aria-modal="true"
          aria-label="Last One Standing intro"
        >
          {prefersReducedMotion ? (
            <div className="los-splash-static">
              <AppLogo onDark losClassName="h-20 w-20" plClassName="h-10 w-auto max-w-[10rem]" />
            </div>
          ) : (
            <video
              ref={videoRef}
              className="los-splash-video"
              src={LANDING_SPLASH_VIDEO_SRC}
              poster={LANDING_SPLASH_POSTER_SRC}
              autoPlay={autoplayVideo}
              muted
              playsInline
              preload="auto"
              onPlaying={handleVideoPlaying}
              onEnded={dismissSplash}
              onError={dismissSplash}
            />
          )}

          <button type="button" className="los-splash-skip los-tap-target" onClick={dismissSplash}>
            Skip intro
          </button>
        </div>
      ) : null}
    </>
  )
}
