import { londonDayOfWeek } from '../../scripts/lib/fixtureValidation'

const SATURDAY = 6
const SUNDAY = 7

export function ukIsoDayOfWeek(kickoffAt: string): number {
  return londonDayOfWeek(kickoffAt)
}

export function isUkWeekendKickoff(kickoffAt: string): boolean {
  const day = ukIsoDayOfWeek(kickoffAt)
  return day === SATURDAY || day === SUNDAY
}

export function isDefaultEligibleUkKickoff(
  kickoffAt: string,
  eligibilityOverride: string | null | undefined = 'none',
): boolean {
  if (eligibilityOverride === 'force_ineligible') return false
  if (eligibilityOverride === 'force_eligible') return true
  return isUkWeekendKickoff(kickoffAt)
}

export function snapshotHasNonWeekendFixture(
  fixtures: Array<{ kickoff_at: string; season_fixture_id?: string }>,
  eligibilityOverrides: Record<string, string> = {},
): boolean {
  return fixtures.some((fixture) => {
    const override = fixture.season_fixture_id ? eligibilityOverrides[fixture.season_fixture_id] : undefined
    return !isDefaultEligibleUkKickoff(fixture.kickoff_at, override ?? 'none')
  })
}
