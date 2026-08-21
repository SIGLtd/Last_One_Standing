import { useCallback, useEffect, useRef, useState } from 'react'
import { AppLogo } from './AppLogo'
import { APP_TAGLINE } from '../lib/constants'
import {
  INTRO_SEEN_KEY,
  LANDING_SPLASH_MAX_MS,
  LANDING_SPLASH_POSTER_SRC,
  LANDING_SPLASH_REDUCED_MOTION_MS,
  LANDING_SPLASH_STALL_MS,
  LANDING_SPLASH_VIDEO_SRC,
  SPLASH_COVER_MEDIA_QUERY,
  decideShowIntro,
  logSplashIssue,
  markIntroSeen,
  shouldAutoplayLandingVideo,
  splashVideoClassName,
  splashVideoFitMode,
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

function readNarrowPortrait(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(SPLASH_COVER_MEDIA_QUERY).matches
}

export function LandingSplash() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [visible, setVisible] = useState(() => decideShowIntro())
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>(() => splashVideoFitMode(readNarrowPortrait()))
  const videoRef = useRef<HTMLVideoElement>(null)
  const dismissedRef = useRef(false)

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    markIntroSeen()
    setVisible(false)
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia(SPLASH_COVER_MEDIA_QUERY)
    const syncFit = () => setFitMode(splashVideoFitMode(mediaQuery.matches))
    syncFit()
    mediaQuery.addEventListener('change', syncFit)
    return () => mediaQuery.removeEventListener('change', syncFit)
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

    let gotFrame = false

    const armMutedInline = () => {
      video.muted = true
      video.defaultMuted = true
      video.playsInline = true
      video.setAttribute('muted', '')
      video.setAttribute('playsinline', '')
      video.setAttribute('webkit-playsinline', '')
    }

    const attemptPlay = () => {
      armMutedInline()
      const playAttempt = video.play()
      if (playAttempt) {
        void playAttempt.catch(() => {
          logSplashIssue('autoplay rejected')
          armMutedInline()
          void video.play().catch(() => {
            logSplashIssue('autoplay retry rejected')
          })
        })
      }
    }

    const onPlaying = () => {
      gotFrame = true
    }

    video.addEventListener('playing', onPlaying)
    video.addEventListener('canplay', attemptPlay)
    attemptPlay()

    const stallTimer = window.setTimeout(() => {
      if (!gotFrame) {
        logSplashIssue('stall before first frame')
        dismiss()
      }
    }, LANDING_SPLASH_STALL_MS)

    return () => {
      window.clearTimeout(stallTimer)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('canplay', attemptPlay)
    }
  }, [dismiss, prefersReducedMotion, visible])

  if (!visible) return null

  const autoplayVideo = shouldAutoplayLandingVideo(prefersReducedMotion)

  return (
    <div
      className={`los-splash-overlay ${fitMode === 'contain' ? 'los-splash-overlay-landscape' : 'los-splash-overlay-portrait'}`}
      role="dialog"
      aria-modal="true"
      aria-label="Last One Standing intro"
    >
      {prefersReducedMotion || !autoplayVideo ? (
        <div className="los-splash-static">
          <AppLogo onDark losClassName="h-20 w-20" plClassName="h-10 w-auto max-w-[10rem]" />
          <p className="los-splash-tagline">{APP_TAGLINE}</p>
        </div>
      ) : (
        <video
          ref={videoRef}
          className={splashVideoClassName(fitMode)}
          src={LANDING_SPLASH_VIDEO_SRC}
          poster={LANDING_SPLASH_POSTER_SRC}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={dismiss}
          onError={() => {
            logSplashIssue('video error')
            dismiss()
          }}
        />
      )}

      <button type="button" className="los-splash-skip los-tap-target" onClick={dismiss} data-intro-key={INTRO_SEEN_KEY}>
        Skip
      </button>
    </div>
  )
}
