import { describe, expect, it } from 'vitest'
import { londonDateFromKickoff, londonDayOfWeek } from '../../scripts/lib/fixtureValidation'
import {
  europeLondonWallTimeToUtcIso,
  fridayIsoDateBeforeLondonDate,
  londonDateTimeLocalToUtcIso,
  proposedFriday1600DeadlineFromEarliestKickoff,
  utcIsoToLondonDateTimeLocal,
} from './londonDeadline'
import { proposedDeadlineFromEarliestKickoff } from './nextRound'

describe('Friday 16:00 Europe/London default deadline', () => {
  it('sets Friday 16:00 UK time before Saturday and Sunday fixtures', () => {
    const saturday = '2026-10-17T11:30:00.000Z'
    const sunday = '2026-10-18T13:00:00.000Z'
    expect(londonDayOfWeek(saturday)).toBe(6)
    expect(londonDayOfWeek(sunday)).toBe(7)
    expect(proposedFriday1600DeadlineFromEarliestKickoff(saturday)).toBe('2026-10-16T15:00:00.000Z')
    expect(proposedDeadlineFromEarliestKickoff(sunday)).toBe('2026-10-16T15:00:00.000Z')
    expect(utcIsoToLondonDateTimeLocal('2026-10-16T15:00:00.000Z')).toBe('2026-10-16T16:00')
  })

  it('converts UK winter time so 16:00 GMT stores as 16:00 UTC', () => {
    expect(europeLondonWallTimeToUtcIso('2026-11-06', 16, 0)).toBe('2026-11-06T16:00:00.000Z')
    expect(proposedFriday1600DeadlineFromEarliestKickoff('2026-11-07T15:00:00.000Z')).toBe('2026-11-06T16:00:00.000Z')
  })

  it('includes Saturday and Sunday kick-offs and excludes Friday and Monday by source date', () => {
    const friday = '2026-10-16T18:00:00.000Z'
    const monday = '2026-10-19T19:00:00.000Z'
    expect(londonDayOfWeek(friday)).toBe(5)
    expect(londonDayOfWeek(monday)).toBe(1)
    expect(londonDayOfWeek('2026-10-17T14:00:00.000Z')).toBe(6)
    expect(londonDayOfWeek('2026-10-18T14:00:00.000Z')).toBe(7)
  })

  it('does not misclassify a UTC Saturday that is still Friday in London', () => {
    const fridayEveningLondon = '2026-10-16T22:30:00.000Z'
    expect(londonDateFromKickoff(fridayEveningLondon)).toBe('2026-10-16')
    expect(londonDayOfWeek(fridayEveningLondon)).toBe(5)
    const saturdayAfterMidnightLondon = '2026-10-16T23:30:00.000Z'
    expect(londonDateFromKickoff(saturdayAfterMidnightLondon)).toBe('2026-10-17')
    expect(londonDayOfWeek(saturdayAfterMidnightLondon)).toBe(6)
    expect(proposedFriday1600DeadlineFromEarliestKickoff(saturdayAfterMidnightLondon)).toBe('2026-10-16T15:00:00.000Z')
  })

  it('does not use the browser local timezone to store datetime-local values', () => {
    expect(londonDateTimeLocalToUtcIso('2026-10-16T16:00')).toBe('2026-10-16T15:00:00.000Z')
    expect(utcIsoToLondonDateTimeLocal('2026-10-16T15:00:00.000Z')).toBe('2026-10-16T16:00')
    expect(fridayIsoDateBeforeLondonDate('2026-10-17', 6)).toBe('2026-10-16')
    expect(fridayIsoDateBeforeLondonDate('2026-10-18', 7)).toBe('2026-10-16')
  })
})
