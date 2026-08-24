import { describe, expect, it } from 'vitest'
import { isDeadlinePassed, parseDeadlineUtcMs } from './deadline'

const DEADLINE_Z = '2026-08-21T15:00:00Z'
const DEADLINE_ISO = '2026-08-21T15:00:00.000Z'
const DEADLINE_PG = '2026-08-21 15:00:00+00'

describe('deadline parsing', () => {
  it('parses ISO Z, ISO with millis, and Postgres UTC timestamps as the same instant', () => {
    expect(parseDeadlineUtcMs(DEADLINE_Z)).toBe(Date.parse('2026-08-21T15:00:00.000Z'))
    expect(parseDeadlineUtcMs(DEADLINE_ISO)).toBe(Date.parse('2026-08-21T15:00:00.000Z'))
    expect(parseDeadlineUtcMs(DEADLINE_PG)).toBe(Date.parse('2026-08-21T15:00:00.000Z'))
  })

  it('treats 2026-08-21T15:00:00Z as passed after that time', () => {
    const justBefore = Date.parse('2026-08-21T14:59:59.000Z')
    const exactly = Date.parse('2026-08-21T15:00:00.000Z')
    const justAfter = Date.parse('2026-08-21T15:00:01.000Z')
    const mondayEvening = Date.parse('2026-08-24T18:30:00.000Z')

    expect(isDeadlinePassed(DEADLINE_Z, justBefore)).toBe(false)
    expect(isDeadlinePassed(DEADLINE_ISO, justBefore)).toBe(false)
    expect(isDeadlinePassed(DEADLINE_PG, justBefore)).toBe(false)

    expect(isDeadlinePassed(DEADLINE_Z, exactly)).toBe(true)
    expect(isDeadlinePassed(DEADLINE_Z, justAfter)).toBe(true)
    expect(isDeadlinePassed(DEADLINE_PG, mondayEvening)).toBe(true)
  })

  it('does not treat an unparseable deadline as passed', () => {
    expect(isDeadlinePassed('', Date.parse('2026-08-24T12:00:00.000Z'))).toBe(false)
    expect(isDeadlinePassed('not-a-date', Date.parse('2026-08-24T12:00:00.000Z'))).toBe(false)
  })
})
