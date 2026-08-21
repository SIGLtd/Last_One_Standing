import { useId } from 'react'
import { TEAM_ID_TO_NAME } from '../config/teams'
import { getTeamIdentity } from '../lib/teamIdentity'

export function TeamChip({
  teamId,
  size = 'md',
}: {
  teamId: string | null | undefined
  size?: 'sm' | 'md'
}) {
  const identity = getTeamIdentity(teamId)
  const fullName = TEAM_ID_TO_NAME.get(identity.teamId) ?? identity.shortName
  const clipId = useId().replace(/:/g, '')
  const dimension = size === 'sm' ? 22 : 28
  const stripe = identity.kit === 'stripe'

  return (
    <span
      className={size === 'sm' ? 'los-team-shirt los-team-shirt-sm' : 'los-team-shirt'}
      role="img"
      aria-label={`${fullName} colours`}
      title={fullName}
      style={{ width: dimension, height: dimension }}
    >
      <svg viewBox="0 0 32 32" width={dimension} height={dimension} aria-hidden="true" focusable="false">
        <path
          d="M6.2 9.2 11.6 11.1 11.2 16.4 4.8 14.6Z"
          fill={identity.secondary}
        />
        <path
          d="M25.8 9.2 20.4 11.1 20.8 16.4 27.2 14.6Z"
          fill={identity.secondary}
        />
        <path
          d="M7.1 9.6 11.4 11.2 11.1 15.6 5.9 14.1Z"
          fill={identity.primary}
        />
        <path
          d="M24.9 9.6 20.6 11.2 20.9 15.6 26.1 14.1Z"
          fill={identity.primary}
        />
        <path
          d="M11.2 8.4c.3-2.1 2.4-3.6 4.8-3.6s4.5 1.5 4.8 3.6l.7 17.4c-1.7.9-3.5 1.4-5.5 1.4s-3.8-.5-5.5-1.4Z"
          fill={identity.primary}
        />
        {stripe ? (
          <>
            <clipPath id={`${clipId}-body`}>
              <path d="M11.2 8.4c.3-2.1 2.4-3.6 4.8-3.6s4.5 1.5 4.8 3.6l.7 17.4c-1.7.9-3.5 1.4-5.5 1.4s-3.8-.5-5.5-1.4Z" />
            </clipPath>
            <g clipPath={`url(#${clipId}-body)`}>
              <rect x="13.1" y="4" width="1.7" height="24" fill={identity.secondary} />
              <rect x="17.2" y="4" width="1.7" height="24" fill={identity.secondary} />
            </g>
          </>
        ) : (
          <path
            d="M11.6 8.8c.4-1.6 2.1-2.8 4.4-2.8 2.3 0 4 1.2 4.4 2.8"
            fill="none"
            stroke={identity.secondary}
            strokeWidth="1.15"
            strokeLinecap="round"
          />
        )}
        <path
          d="M13.15 5.55c.7 1.55 1.55 2.35 2.85 2.35s2.15-.8 2.85-2.35"
          fill="none"
          stroke={identity.secondary}
          strokeWidth="1.35"
          strokeLinecap="round"
        />
        <path
          d="M13.6 5.7c.6 1.2 1.3 1.85 2.4 1.85s1.8-.65 2.4-1.85"
          fill={identity.primary}
        />
      </svg>
    </span>
  )
}
