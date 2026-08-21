import { useId } from 'react'
import { TEAM_ID_TO_NAME } from '../config/teams'
import { getTeamIdentity, type TeamIdentity, type TeamKitStyle } from '../lib/teamIdentity'

const SIZE_PX = {
  sm: 26,
  md: 32,
  lg: 38,
} as const

const SHIRT_D =
  'M14.2 8.4H19.6C20.6 10.8 22.2 12 24 12C25.8 12 27.4 10.8 28.4 8.4H33.8C34.8 8.4 35.6 9.2 35.6 10.2V12.1L41.2 14.4 39.8 20.6 35 19.1V29.1C35 30.3 34 31.3 32.8 31.3H15.2C14 31.3 13 30.3 13 29.1V19.1L8.2 20.6 6.8 14.4 12.4 12.1V10.2C12.4 9.2 13.2 8.4 14.2 8.4Z'

const TORSO_D = 'M13 12.4H35V31.3H13Z'

const LEFT_SLEEVE_D = 'M13 12.1 13 19.1 8.2 20.6 6.8 14.4Z'
const RIGHT_SLEEVE_D = 'M35 12.1 35 19.1 39.8 20.6 41.2 14.4Z'

const SHORTS_D =
  'M15.6 33.2H32.4C33.6 33.2 34.6 34.2 34.6 35.4L33.9 42.5C33.7 43.6 32.8 44.4 31.7 44.4H16.3C15.2 44.4 14.3 43.6 14.1 42.5L13.4 35.4C13.4 34.2 14.4 33.2 15.6 33.2Z'

const COLLAR_D =
  'M18.8 8.4H29.2C28 11.6 25.6 13.1 24 13.1C22.4 13.1 20 11.6 18.8 8.4Z'

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
        <rect x="24" y="8" width="14" height="24" fill={identity.secondary} />
      </g>
    )
  }

  if (kit === 'centreStripe') {
    return (
      <g clipPath={`url(#${clipId}-torso)`}>
        <rect x="21.4" y="8" width="5.2" height="24" fill={identity.secondary} />
      </g>
    )
  }

  if (kit === 'verticalStripes') {
    return (
      <g clipPath={`url(#${clipId}-torso)`}>
        <rect x="16.2" y="8" width="3.4" height="24" fill={identity.secondary} />
        <rect x="22.3" y="8" width="3.4" height="24" fill={identity.secondary} />
        <rect x="28.4" y="8" width="3.4" height="24" fill={identity.secondary} />
      </g>
    )
  }

  if (kit === 'hoops') {
    return (
      <g clipPath={`url(#${clipId}-torso)`}>
        <rect x="12" y="16.4" width="24" height="3.4" fill={identity.secondary} />
        <rect x="12" y="22.4" width="24" height="3.4" fill={identity.secondary} />
      </g>
    )
  }

  return (
    <g clipPath={`url(#${clipId}-torso)`}>
      <rect x="7" y="20" width="34" height="5" fill={identity.secondary} transform="rotate(-28 24 22)" />
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
  const collarFill = identity.textOnPrimary === '#ffffff' ? 'rgba(255,255,255,0.22)' : 'rgba(20,18,26,0.16)'

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
        <path d={SHIRT_D} fill="none" stroke="rgba(20,18,26,0.14)" strokeWidth="0.8" strokeLinejoin="round" />

        <path d={SHORTS_D} fill={shortsFill} />
        <path d={SHORTS_D} fill="#14121a" opacity="0.12" />
        <path d={SHORTS_D} fill="none" stroke="rgba(20,18,26,0.14)" strokeWidth="0.8" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
