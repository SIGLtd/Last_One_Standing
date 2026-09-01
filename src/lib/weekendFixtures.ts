import { londonDayOfWeek } from '../../scripts/lib/fixtureValidation'

const SATURDAY = 6
const SUNDAY = 7

export const INVALID_WEEKDAY_SNAPSHOT_WARNING =
  'This round includes a Friday/Monday fixture. Review required.'

export function hasReliableKickoff(kickoffAt: string | null | undefined): boolean {
  if (!kickoffAt || !kickoffAt.trim()) return false
  return Number.isFinite(Date.parse(kickoffAt))
}

export function ukIsoDayOfWeek(kickoffAt: string): number {
  if (!hasReliableKickoff(kickoffAt)) return 0
  return londonDayOfWeek(kickoffAt)
}

export function isUkWeekendKickoff(kickoffAt: string): boolean {
  const day = ukIsoDayOfWeek(kickoffAt)
  return day === SATURDAY || day === SUNDAY
}

export function canonicalKeyDate(canonicalKey: string | null | undefined): string | null {
  if (!canonicalKey) return null
  const date = canonicalKey.split('|')[3]?.trim() ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  return date
}

export function isoDateUkIsoDow(isoDate: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return 0
  return londonDayOfWeek(`${isoDate}T12:00:00.000Z`)
}

export function canonicalKeyIsUkWeekend(canonicalKey: string | null | undefined): boolean | null {
  const date = canonicalKeyDate(canonicalKey)
  if (!date) return null
  const dow = isoDateUkIsoDow(date)
  if (dow < 1) return null
  return dow === SATURDAY || dow === SUNDAY
}

export function isDefaultEligibleUkKickoff(
  kickoffAt: string,
  eligibilityOverride: string | null | undefined = 'none',
): boolean {
  if (!hasReliableKickoff(kickoffAt)) return false
  if (eligibilityOverride === 'force_ineligible') return false
  if (eligibilityOverride === 'force_eligible') return true
  return isUkWeekendKickoff(kickoffAt)
}

export function isLosRoundEligibleFixture(input: {
  kickoff_at: string | null | undefined
  eligibility_override?: string | null
  canonical_key?: string | null
  matchday?: number | string | null
}): boolean {
  if (!hasReliableKickoff(input.kickoff_at)) return false
  if (input.eligibility_override === 'force_ineligible') return false
  if (input.eligibility_override === 'force_eligible') return true
  if (!isUkWeekendKickoff(input.kickoff_at as string)) return false
  const canonicalWeekend = canonicalKeyIsUkWeekend(input.canonical_key)
  if (canonicalWeekend === false) return false
  return true
}

export function snapshotHasNonWeekendFixture(
  fixtures: Array<{ kickoff_at: string; season_fixture_id?: string; canonical_key?: string | null }>,
  eligibilityOverrides: Record<string, string> = {},
): boolean {
  return fixtures.some((fixture) => {
    const override = fixture.season_fixture_id ? eligibilityOverrides[fixture.season_fixture_id] : undefined
    return !isLosRoundEligibleFixture({
      kickoff_at: fixture.kickoff_at,
      eligibility_override: override ?? 'none',
      canonical_key: fixture.canonical_key,
    })
  })
}
