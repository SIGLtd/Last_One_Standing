import { useId } from 'react'
import { TEAM_ID_TO_NAME } from '../config/teams'
import { getTeamIdentity, type TeamIdentity, type TeamKitStyle } from '../lib/teamIdentity'

const SIZE_PX = {
  sm: 26,
  md: 32,
  lg: 38,
} as const

const SHIRT_D =
  'M15.2 7.6H19.8C20.7 10 22.2 11.2 24 11.2C25.8 11.2 27.3 10 28.2 7.6H32.8C33.7 7.6 34.4 8.3 34.4 9.2V11.2L39.2 13.4 38 19.2 33.6 17.8V26.6C33.6 27.6 32.8 28.4 31.8 28.4H16.2C15.2 28.4 14.4 27.6 14.4 26.6V17.8L10 19.2 8.8 13.4 13.6 11.2V9.2C13.6 8.3 14.3 7.6 15.2 7.6Z'

const TORSO_D = 'M14.4 11.6H33.6V28.4H14.4Z'

const LEFT_SLEEVE_D = 'M14.4 11.2 14.4 17.8 10 19.2 8.8 13.4Z'
const RIGHT_SLEEVE_D = 'M33.6 11.2 33.6 17.8 38 19.2 39.2 13.4Z'

const SHORTS_D =
  'M16.4 31.2H31.6C32.7 31.2 33.6 32.1 33.6 33.2L32.9 41.2C32.7 42.4 31.7 43.2 30.5 43.2H17.5C16.3 43.2 15.3 42.4 15.1 41.2L14.4 33.2C14.4 32.1 15.3 31.2 16.4 31.2Z'

const COLLAR_D =
  'M19.4 7.6H28.6C27.5 10.6 25.4 12 24 12C22.6 12 20.5 10.6 19.4 7.6Z'

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
      <>
        <path d={LEFT_SLEEVE_D} fill={identity.secondary} />
        <path d={RIGHT_SLEEVE_D} fill={identity.secondary} />
      </>
    )
  }

  if (kit === 'halves') {
    return (
      <g clipPath={`url(#${clipId}-torso)`}>
        <rect x="24" y="8" width="12" height="22" fill={identity.secondary} />
      </g>
    )
  }

  if (kit === 'centreStripe') {
    return (
      <g clipPath={`url(#${clipId}-torso)`}>
        <rect x="21.6" y="8" width="4.8" height="22" fill={identity.secondary} />
      </g>
    )
  }

  if (kit === 'verticalStripes') {
    return (
      <g clipPath={`url(#${clipId}-torso)`}>
        <rect x="17.2" y="8" width="3.1" height="22" fill={identity.secondary} />
        <rect x="22.45" y="8" width="3.1" height="22" fill={identity.secondary} />
        <rect x="27.7" y="8" width="3.1" height="22" fill={identity.secondary} />
      </g>
    )
  }

  if (kit === 'hoops') {
    return (
      <g clipPath={`url(#${clipId}-torso)`}>
        <rect x="14" y="16" width="20" height="3.1" fill={identity.secondary} />
        <rect x="14" y="21.4" width="20" height="3.1" fill={identity.secondary} />
      </g>
    )
  }

  return (
    <g clipPath={`url(#${clipId}-torso)`}>
      <rect x="8" y="18.6" width="32" height="4.4" fill={identity.secondary} transform="rotate(-28 24 21)" />
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
  const clipId = `kit${useId().replace(/:/g, '')}`
  const dimension = SIZE_PX[size]
  const shortsFill =
    identity.kit === 'sleeves' || identity.kit === 'halves' ? identity.secondary : identity.primary
  const collarFill = identity.textOnPrimary === '#ffffff' ? 'rgba(255,255,255,0.22)' : 'rgba(20,18,26,0.18)'

  return (
    <span
      className={size === 'lg' ? 'los-team-shirt los-team-shirt-lg' : 'los-team-shirt'}
      role="img"
      aria-label={`${fullName} colours`}
      title={fullName}
      style={{ width: dimension, height: dimension }}
    >
      <svg viewBox="0 0 48 48" width={dimension} height={dimension} aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={`${clipId}-torso`}>
            <path d={TORSO_D} />
          </clipPath>
        </defs>

        <path d={SHIRT_D} fill={identity.primary} />
        <KitArtwork kit={identity.kit} identity={identity} clipId={clipId} />
        <path d={COLLAR_D} fill={collarFill} />
        <path d={SHIRT_D} fill="none" stroke="rgba(20,18,26,0.16)" strokeWidth="0.75" strokeLinejoin="round" />

        <path d={SHORTS_D} fill={shortsFill} />
        <path d={SHORTS_D} fill="#14121a" opacity="0.22" />
        <path d={SHORTS_D} fill="none" stroke="rgba(20,18,26,0.16)" strokeWidth="0.75" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
