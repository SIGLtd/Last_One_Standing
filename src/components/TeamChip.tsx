import { getTeamIdentity } from '../lib/teamIdentity'

export function TeamChip({
  teamId,
  size = 'md',
}: {
  teamId: string | null | undefined
  size?: 'sm' | 'md'
}) {
  const identity = getTeamIdentity(teamId)
  const dimension = size === 'sm' ? '1.35rem' : '1.75rem'
  const background =
    identity.kit === 'stripe'
      ? `linear-gradient(90deg, ${identity.primary} 50%, ${identity.secondary} 50%)`
      : identity.primary

  return (
    <span
      className="los-team-chip"
      style={{
        width: dimension,
        height: dimension,
        background,
        color: identity.textOnPrimary,
        boxShadow: `0 0 0 1px ${identity.secondary}`,
      }}
      aria-hidden="true"
      title={identity.shortName}
    >
      {identity.initials}
    </span>
  )
}
