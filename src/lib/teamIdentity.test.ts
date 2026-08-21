import { describe, expect, it } from 'vitest'
import { TEAMS_2026 } from '../config/teams'
import { allKnownTeamsHaveIdentity, getTeamIdentity, teamIdentityFallbackSafe } from './teamIdentity'

describe('team visual identity', () => {
  it('gives every known Premier League team a colour chip fallback', () => {
    expect(allKnownTeamsHaveIdentity()).toBe(true)
    for (const team of TEAMS_2026) {
      const identity = getTeamIdentity(team.id)
      expect(identity.primary).toMatch(/^#/)
      expect(identity.secondary).toMatch(/^#/)
      expect(identity.initials.length).toBeGreaterThanOrEqual(2)
      expect(identity.shortName.length).toBeGreaterThan(1)
      expect(identity.textOnPrimary).toMatch(/^#/)
    }
  })

  it('does not crash for unknown or empty team ids', () => {
    expect(teamIdentityFallbackSafe('zzz')).toBe(true)
    expect(getTeamIdentity('zzz').shortName).toBe('Unknown')
    expect(getTeamIdentity(null).initials).toBe('LOS')
    expect(getTeamIdentity(undefined).primary).toBe('#37003c')
  })

  it('keeps readable names alongside colour', () => {
    expect(getTeamIdentity('mun').shortName).toBe('Man United')
    expect(getTeamIdentity('mci').shortName).toBe('Man City')
    expect(getTeamIdentity('liv').primary).toBe('#C8102E')
  })
})
