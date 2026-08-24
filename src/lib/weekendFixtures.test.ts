import { describe, expect, it } from 'vitest'
import { isStandardEligibleFixture } from '../../scripts/lib/weekendEligibility'
import { londonDayOfWeek } from '../../scripts/lib/fixtureValidation'
import { isDefaultEligibleUkKickoff, isUkWeekendKickoff, snapshotHasNonWeekendFixture, ukIsoDayOfWeek } from './weekendFixtures'

describe('UK weekend fixture eligibility', () => {
  it('includes Saturday and Sunday kickoffs in UK local time', () => {
    expect(isUkWeekendKickoff('2026-08-22T11:30:00.000Z')).toBe(true)
    expect(ukIsoDayOfWeek('2026-08-22T11:30:00.000Z')).toBe(6)
    expect(isUkWeekendKickoff('2026-08-23T15:30:00.000Z')).toBe(true)
    expect(ukIsoDayOfWeek('2026-08-23T15:30:00.000Z')).toBe(7)
  })

  it('excludes Friday, Monday, and midweek by default', () => {
    expect(isUkWeekendKickoff('2026-08-21T19:00:00.000Z')).toBe(false)
    expect(ukIsoDayOfWeek('2026-08-21T19:00:00.000Z')).toBe(5)
    expect(isUkWeekendKickoff('2026-08-24T19:00:00.000Z')).toBe(false)
    expect(ukIsoDayOfWeek('2026-08-24T19:00:00.000Z')).toBe(1)
    expect(isUkWeekendKickoff('2026-08-19T19:00:00.000Z')).toBe(false)
    expect(isDefaultEligibleUkKickoff('2026-08-24T19:00:00.000Z', 'none')).toBe(false)
  })

  it('uses UK local day rather than naive UTC', () => {
    const sundayUtcThatIsMondayInLondon = '2026-08-23T23:00:00.000Z'
    expect(new Date(sundayUtcThatIsMondayInLondon).getUTCDay()).toBe(0)
    expect(ukIsoDayOfWeek(sundayUtcThatIsMondayInLondon)).toBe(1)
    expect(isUkWeekendKickoff(sundayUtcThatIsMondayInLondon)).toBe(false)
  })

  it('allows an explicit Admin exception for a Monday fixture', () => {
    expect(isDefaultEligibleUkKickoff('2026-08-24T19:00:00.000Z', 'force_eligible')).toBe(true)
    expect(
      isStandardEligibleFixture('2026-08-24T19:00:00.000Z', 'force_eligible', 'scheduled', londonDayOfWeek),
    ).toBe(true)
    expect(
      snapshotHasNonWeekendFixture(
        [{ kickoff_at: '2026-08-24T19:00:00.000Z', season_fixture_id: 'ful-che' }],
        { 'ful-che': 'force_eligible' },
      ),
    ).toBe(false)
    expect(
      snapshotHasNonWeekendFixture([{ kickoff_at: '2026-08-24T19:00:00.000Z', season_fixture_id: 'ful-che' }]),
    ).toBe(true)
  })
})
