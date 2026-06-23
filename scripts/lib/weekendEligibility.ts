export function isStandardEligibleFixture(
  kickoff: string,
  override: string,
  status: string | undefined,
  londonIsodow: (kickoffUtc: string) => number,
): boolean {
  const fixtureStatus = status ?? 'scheduled'
  if (override === 'force_ineligible') return false
  if (override === 'force_eligible') return ['scheduled', 'in_play'].includes(fixtureStatus)
  if (override === 'none' || !override) {
    return ['scheduled', 'in_play'].includes(fixtureStatus) && [6, 7].includes(londonIsodow(kickoff))
  }
  return false
}

export function filterEligibleWeekendFixtures<
  T extends { kickoff_at: string; eligibility_override?: string; status?: string },
>(
  fixtures: T[],
  sat: string,
  sun: string,
  londonDate: (kickoffUtc: string) => string,
  londonIsodow: (kickoffUtc: string) => number,
): T[] {
  return fixtures.filter((fixture) => {
    const day = londonDate(fixture.kickoff_at)
    if (day < sat || day > sun) return false
    return isStandardEligibleFixture(
      fixture.kickoff_at,
      fixture.eligibility_override ?? 'none',
      fixture.status,
      londonIsodow,
    )
  })
}
