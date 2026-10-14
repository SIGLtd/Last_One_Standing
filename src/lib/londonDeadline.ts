import { londonDateFromKickoff, londonDayOfWeek } from '../../scripts/lib/fixtureValidation'

export const LONDON_TIME_ZONE = 'Europe/London'
export const DEFAULT_ROUND_DEADLINE_HOUR = 16
export const DEFAULT_ROUND_DEADLINE_MINUTE = 0

const DAYS_BACK_TO_FRIDAY: Record<number, number> = {
  1: 3,
  2: 4,
  3: 5,
  4: 6,
  5: 0,
  6: 1,
  7: 2,
}

function londonOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - utcMs
}

export function addIsoDateDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Convert a Europe/London wall time on an ISO date into a UTC ISO timestamp. */
export function europeLondonWallTimeToUtcIso(isoDate: string, hour: number, minute = 0): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return ''
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0)
  const adjusted = utcGuess - londonOffsetMs(utcGuess)
  const confirmed = utcGuess - londonOffsetMs(adjusted)
  return new Date(confirmed).toISOString()
}

export function utcIsoToLondonDateTimeLocal(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

export function londonDateTimeLocalToUtcIso(local: string): string {
  const match = local.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/)
  if (!match) return ''
  return europeLondonWallTimeToUtcIso(match[1], Number(match[2]), Number(match[3]))
}

export function fridayIsoDateBeforeLondonDate(londonDate: string, londonDow: number): string {
  const daysBack = DAYS_BACK_TO_FRIDAY[londonDow] ?? 0
  return addIsoDateDays(londonDate, -daysBack)
}

/** Default deadline: 16:00 Europe/London on the Friday before the first eligible Sat/Sun kick-off. */
export function proposedFriday1600DeadlineFromEarliestKickoff(earliestKickoffAt: string | null): string | null {
  if (!earliestKickoffAt) return null
  const londonDate = londonDateFromKickoff(earliestKickoffAt)
  const dow = londonDayOfWeek(earliestKickoffAt)
  if (!londonDate || !dow) return null
  const friday = fridayIsoDateBeforeLondonDate(londonDate, dow)
  return europeLondonWallTimeToUtcIso(friday, DEFAULT_ROUND_DEADLINE_HOUR, DEFAULT_ROUND_DEADLINE_MINUTE)
}
