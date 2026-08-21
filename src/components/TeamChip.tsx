import { useId } from 'react'
import { TEAM_ID_TO_NAME } from '../config/teams'
import { getTeamIdentity, type TeamIdentity, type TeamKitStyle } from '../lib/teamIdentity'

const SIZE_PX = {
  sm: 24,
  md: 32,
  lg: 44,
} as const

/** Original shirt silhouette with a neck cut-out. */
const SHIRT_D =
  'M16 16C18 10.6 24.4 7.6 32 7.6C39.6 7.6 46 10.6 48 16L49.6 19.2L59.6 16.4C60.7 16.1 61.8 17.2 61.5 18.6L59.6 30.4C59.3 31.6 58.1 32.2 56.8 31.8L48.2 29.2L47.7 53.4C47.5 56.2 40.6 58.7 32 58.7C23.4 58.7 16.5 56.2 16.3 53.4L15.8 29.2L7.2 31.8C5.9 32.2 4.7 31.6 4.4 30.4L2.5 18.6C2.2 17.2 3.3 16.1 4.4 16.4L14.4 19.2Z'

const NECK_D =
  'M32 9.1C28.7 9.1 26.5 11 26.1 14.1C29.3 17.8 34.7 17.8 37.9 14.1C37.5 11 35.3 9.1 32 9.1Z'

const BODY_D =
  'M16.4 18.2C17.4 12.2 24.2 9.8 32 9.8C39.8 9.8 46.6 12.2 47.6 18.2L47.6 53.2C42.1 57.2 21.9 57.2 16.4 53.2Z'

const LEFT_CUFF_D = 'M4.8 18.8 3.6 28.8 8.2 30.2 9.2 20.4Z'
const RIGHT_CUFF_D = 'M59.2 18.8 60.4 28.8 55.8 30.2 54.8 20.4Z'

function KitArtwork({
  kit,
  identity,
  clipId,
}: {
  kit: TeamKitStyle
  identity: TeamIdentity
  clipId: string
}) {
  if (kit === 'solid') return null

  if (kit === 'sleeves') {
    return (
      <g clipPath={`url(#${clipId}-body)`}>
        <rect x="16" y="8" width="32" height="52" fill={identity.primary} />
      </g>
    )
  }

  if (kit === 'halves') {
    return (
      <g clipPath={`url(#${clipId}-body)`}>
        <rect x="32" y="8" width="20" height="52" fill={identity.secondary} />
      </g>
    )
  }

  if (kit === 'centreStripe') {
    return (
      <g clipPath={`url(#${clipId}-body)`}>
        <rect x="27.2" y="8" width="9.6" height="52" fill={identity.secondary} />
      </g>
    )
  }

  if (kit === 'verticalStripes') {
    return (
      <g clipPath={`url(#${clipId}-body)`}>
        <rect x="17.4" y="8" width="4.2" height="52" fill={identity.secondary} />
        <rect x="25.6" y="8" width="4.2" height="52" fill={identity.secondary} />
        <rect x="34.2" y="8" width="4.2" height="52" fill={identity.secondary} />
        <rect x="42.4" y="8" width="4.2" height="52" fill={identity.secondary} />
      </g>
    )
  }

  if (kit === 'hoops') {
    return (
      <g clipPath={`url(#${clipId}-body)`}>
        <rect x="14" y="24" width="36" height="5.4" fill={identity.secondary} />
        <rect x="14" y="35.5" width="36" height="5.4" fill={identity.secondary} />
        <rect x="14" y="47" width="36" height="5.4" fill={identity.secondary} />
      </g>
    )
  }

  return (
    <g clipPath={`url(#${clipId}-body)`}>
      <rect
        x="8"
        y="28"
        width="52"
        height="9"
        fill={identity.secondary}
        transform="rotate(-32 32 32)"
      />
    </g>
  )
}

export function TeamChip({
  teamId,
  size = 'md',
}: {
  teamId: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
}) {
  const identity = getTeamIdentity(teamId)
  const fullName = TEAM_ID_TO_NAME.get(identity.teamId) ?? identity.shortName
  const clipId = `shirt${useId().replace(/:/g, '')}`
  const dimension = SIZE_PX[size]
  const showNumber = size !== 'sm'
  const baseFill = identity.kit === 'sleeves' ? identity.secondary : identity.primary
  const numberFill = identity.kit === 'sleeves' ? identity.textOnPrimary : identity.trim

  return (
    <span
      className={size === 'lg' ? 'los-team-shirt los-team-shirt-lg' : 'los-team-shirt'}
      role="img"
      aria-label={`${fullName} colours`}
      title={fullName}
      style={{ width: dimension, height: dimension }}
    >
      <svg viewBox="0 0 64 64" width={dimension} height={dimension} aria-hidden="true" focusable="false">
        <defs>
          <filter id={`${clipId}-shadow`} x="-18%" y="-10%" width="140%" height="140%">
            <feDropShadow dx="1.1" dy="1.8" stdDeviation="1.15" floodColor="#14121a" floodOpacity="0.28" />
          </filter>
          <clipPath id={`${clipId}-shirt`}>
            <path d={`${SHIRT_D} ${NECK_D}`} fillRule="evenodd" />
          </clipPath>
          <clipPath id={`${clipId}-body`}>
            <path d={`${BODY_D} ${NECK_D}`} fillRule="evenodd" />
          </clipPath>
        </defs>

        <g filter={`url(#${clipId}-shadow)`}>
          <path d={`${SHIRT_D} ${NECK_D}`} fill={baseFill} fillRule="evenodd" />
        </g>

        <g clipPath={`url(#${clipId}-shirt)`}>
          <KitArtwork kit={identity.kit} identity={identity} clipId={clipId} />
          <path d={LEFT_CUFF_D} fill={identity.trim} />
          <path d={RIGHT_CUFF_D} fill={identity.trim} />
          <path d="M16.2 16 32 14.6 47.8 16 46.2 21.5 32 20.2 17.8 21.5Z" fill="#ffffff" opacity="0.12" />
          <path d="M33.2 16 47.8 18.4 47.2 54.8 33.2 56.4Z" fill="#14121a" opacity="0.1" />
        </g>

        <path
          d={`${SHIRT_D} ${NECK_D}`}
          fill="none"
          fillRule="evenodd"
          stroke="rgba(20,18,26,0.22)"
          strokeWidth="1.15"
          strokeLinejoin="round"
        />
        <path
          d={NECK_D}
          fill="none"
          stroke={identity.trim}
          strokeWidth="2.3"
          strokeLinejoin="round"
        />

        {showNumber ? (
          <text
            x="32"
            y="42.5"
            textAnchor="middle"
            fill={numberFill}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize="15.5"
            fontWeight="800"
            letterSpacing="-0.08em"
          >
            10
          </text>
        ) : null}
      </svg>
    </span>
  )
}
