import { useCallback, useEffect, useRef, useState } from 'react'
import { AppLogo } from './AppLogo'
import { APP_TAGLINE } from '../lib/constants'
import {
  INTRO_SEEN_KEY,
  LANDING_SPLASH_MAX_MS,
  LANDING_SPLASH_POSTER_SRC,
  LANDING_SPLASH_REDUCED_MOTION_MS,
  LANDING_SPLASH_VIDEO_SRC,
  decideShowIntro,
  markIntroSeen,
  shouldAutoplayLandingVideo,
} from '../lib/landingSplash'

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

export function LandingSplash() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [visible, setVisible] = useState(() => decideShowIntro())
  const videoRef = useRef<HTMLVideoElement>(null)
  const dismissedRef = useRef(false)

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    markIntroSeen()
    setVisible(false)
  }, [])

  useEffect(() => {
    if (!visible) return

    const maxTimer = window.setTimeout(
      () => dismiss(),
      prefersReducedMotion ? LANDING_SPLASH_REDUCED_MOTION_MS : LANDING_SPLASH_MAX_MS,
    )
    return () => window.clearTimeout(maxTimer)
  }, [dismiss, prefersReducedMotion, visible])

  useEffect(() => {
    if (!visible || prefersReducedMotion) return
    const video = videoRef.current
    if (!video) return
    void video.play().catch(() => dismiss())
  }, [dismiss, prefersReducedMotion, visible])

  if (!visible) return null

  const autoplayVideo = shouldAutoplayLandingVideo(prefersReducedMotion)

  return (
    <div className="los-splash-overlay" role="dialog" aria-modal="true" aria-label="Last One Standing intro">
      {prefersReducedMotion || !autoplayVideo ? (
        <div className="los-splash-static">
          <AppLogo onDark losClassName="h-20 w-20" plClassName="h-10 w-auto max-w-[10rem]" />
          <p className="los-splash-tagline">{APP_TAGLINE}</p>
        </div>
      ) : (
        <video
          ref={videoRef}
          className="los-splash-video"
          src={LANDING_SPLASH_VIDEO_SRC}
          poster={LANDING_SPLASH_POSTER_SRC}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={dismiss}
          onError={dismiss}
        />
      )}

      <button type="button" className="los-splash-skip los-tap-target" onClick={dismiss} data-intro-key={INTRO_SEEN_KEY}>
        Skip
      </button>
    </div>
  )
}
