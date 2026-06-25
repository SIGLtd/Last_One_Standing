import { useEffect, useState } from 'react'
import { fetchOpenSelectionWindow } from '../lib/fixtureOps'
import { fetchCurrentGame } from '../lib/gameEntries'
import { PUBLIC_ROUND1_OPEN_POINTS } from '../lib/round1'
import { PUBLIC_APP_INTRO, PUBLIC_PRE_LAUNCH_POINTS } from '../lib/preLaunch'
import { isSupabaseConfigured } from '../lib/supabase'

type RoundStatusNoticeProps = {
  title?: string
  className?: string
}

export function RoundStatusNotice({ title, className = '' }: RoundStatusNoticeProps) {
  const [roundOpen, setRoundOpen] = useState<boolean | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setRoundOpen(false)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const game = await fetchCurrentGame()
        if (!game) {
          if (!cancelled) setRoundOpen(false)
          return
        }
        const openWindow = await fetchOpenSelectionWindow(game.id)
        if (!cancelled) setRoundOpen(Boolean(openWindow))
      } catch {
        if (!cancelled) setRoundOpen(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  if (roundOpen === null) {
    return (
      <div className={`los-notice text-xs ${className}`.trim()}>
        <p className="text-muted-ink">Checking round status…</p>
      </div>
    )
  }

  const points = roundOpen ? PUBLIC_ROUND1_OPEN_POINTS : PUBLIC_PRE_LAUNCH_POINTS
  const heading = title ?? (roundOpen ? 'Round 1 is open' : 'Pre-launch')

  return (
    <div className={`los-notice text-xs ${className}`.trim()}>
      <p className="font-medium text-ink">{heading}</p>
      <ul className="mt-1 list-disc pl-4 text-muted-ink">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </div>
  )
}

export function PublicAppIntro() {
  return <p className="mt-1 text-xs text-muted-ink max-w-prose">{PUBLIC_APP_INTRO}</p>
}
