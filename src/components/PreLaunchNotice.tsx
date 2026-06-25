import type { ReactNode } from 'react'
import { PUBLIC_APP_INTRO, PUBLIC_PRE_LAUNCH_POINTS } from '../lib/preLaunch'

type PreLaunchNoticeProps = {
  title?: string
  className?: string
}

export function PreLaunchNotice({ title = 'Pre-launch', className = '' }: PreLaunchNoticeProps) {
  return (
    <div className={`los-notice text-xs ${className}`.trim()}>
      <p className="font-medium text-ink">{title}</p>
      <ul className="mt-1 list-disc pl-4 text-muted-ink">
        {PUBLIC_PRE_LAUNCH_POINTS.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </div>
  )
}

export function PublicAppIntro({ children }: { children?: ReactNode }) {
  return (
    <p className="mt-1 text-xs text-muted-ink max-w-prose">
      {children ?? PUBLIC_APP_INTRO}
    </p>
  )
}
