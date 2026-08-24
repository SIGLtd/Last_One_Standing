/** Parse a stored window deadline as UTC milliseconds. Postgres `timestamp with time zone` often comes back as `2026-08-21 15:00:00+00`. */
export function parseDeadlineUtcMs(deadlineAt: string): number {
  const trimmed = deadlineAt.trim()
  if (!trimmed) return Number.NaN

  const withT = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  const normalised = withT
    .replace(/([+-]\d{2})$/, '$1:00')
    .replace(/([+-]\d{2})(\d{2})$/, '$1:$2')

  const parsed = Date.parse(normalised)
  if (Number.isFinite(parsed)) return parsed

  const asZulu = /[zZ]|[+-]\d{2}/.test(withT) ? withT : `${withT}Z`
  const fallback = Date.parse(asZulu)
  return Number.isFinite(fallback) ? fallback : Number.NaN
}

/** True at or after the deadline instant. Invalid/unparseable deadlines are treated as not passed. */
export function isDeadlinePassed(deadlineAt: string, nowMs = Date.now()): boolean {
  const deadlineMs = parseDeadlineUtcMs(deadlineAt)
  if (!Number.isFinite(deadlineMs)) return false
  return nowMs >= deadlineMs
}
