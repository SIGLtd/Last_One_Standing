import { formatCompactKickoffLondon } from '../../../lib/fixtureOps'
import type { SelectionWindowEligibleFixture } from '../../../types'

export const CONSENSUS_BAR_COLOURS = ['#00e5a3', '#caf300', '#e7b3ff'] as const

export function londonDayHeading(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function londonKickoffClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function groupFixturesByLondonDay(fixtures: SelectionWindowEligibleFixture[]) {
  const groups: Array<{ heading: string; fixtures: SelectionWindowEligibleFixture[] }> = []
  const index = new Map<string, number>()
  const sorted = [...fixtures].sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))
  for (const fixture of sorted) {
    const heading = londonDayHeading(fixture.kickoff_at)
    const existing = index.get(heading)
    if (existing == null) {
      index.set(heading, groups.length)
      groups.push({ heading, fixtures: [fixture] })
    } else {
      groups[existing]?.fixtures.push(fixture)
    }
  }
  return groups
}

export function kickoffLabel(iso: string): string {
  return formatCompactKickoffLondon(iso)
}
