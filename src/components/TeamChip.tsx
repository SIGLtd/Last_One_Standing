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
  const dimension = size === 'sm' ? '1.5rem' : '1.75rem'
  const background =
    identity.kit === 'stripe'
      ? `linear-gradient(90deg, ${identity.primary} 50%, ${identity.secondary} 50%)`
      : identity.primary

  return (
    <span
      className={size === 'sm' ? 'los-team-chip los-team-chip-sm' : 'los-team-chip'}
      role="img"
      aria-label={fullName}
      title={fullName}
      style={{
        width: dimension,
        height: dimension,
        background,
        color: identity.textOnPrimary,
      }}
    >
      {identity.initials}
    </span>
  )
}
