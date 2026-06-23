import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DateTime } from 'luxon'
import { canonicalKey, resolveTeamId, SEASON } from './lib/teamsCatalog'
import { kickoffToLondonIso, validateFixtureArtefact, type FixtureArtefactRow } from './lib/fixtureValidation'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'data', 'fixtures', '2026-27')

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
}

function londonKickoffToUtc(year: number, month: number, day: number, hour: number, minute: number): string {
  return DateTime.fromObject({ year, month, day, hour, minute }, { zone: 'Europe/London' }).toUTC().toISO()!
}

function inferYear(month: number, explicitYear?: number): number {
  if (explicitYear) return explicitYear
  return month >= 8 ? 2026 : 2027
}

function defaultKickoffForWeekday(weekday: string, isMidweek: boolean): { hour: number; minute: number } {
  if (isMidweek || weekday === 'friday' || weekday === 'monday') return { hour: 20, minute: 0 }
  return { hour: 15, minute: 0 }
}

function parseLine(line: string): FixtureArtefactRow | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const match = trimmed.match(
    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?(?:\s+(\d{1,2}):(\d{2}))?\s+(.+?)\s+v\s+(.+)$/i,
  )
  if (!match) return null

  const [, weekday, dayStr, monthName, yearStr, hourStr, minuteStr, homeName, awayName] = match
  const month = MONTHS[monthName.toLowerCase()]
  if (!month) return null

  const day = Number(dayStr)
  const year = inferYear(month, yearStr ? Number(yearStr) : undefined)
  const isMidweek = weekday.toLowerCase() === 'wednesday'
  const defaults = defaultKickoffForWeekday(weekday.toLowerCase(), isMidweek)
  const hour = hourStr ? Number(hourStr) : defaults.hour
  const minute = minuteStr ? Number(minuteStr) : defaults.minute

  const homeId = resolveTeamId(homeName)
  const awayId = resolveTeamId(awayName)
  if (!homeId || !awayId) {
    throw new Error(`Unmapped teams on line: ${trimmed}`)
  }

  const kickoffUtc = londonKickoffToUtc(year, month, day, hour, minute)
  return {
    source_fixture_id: null,
    canonical_key: canonicalKey(SEASON, homeId, awayId, kickoffUtc),
    season: SEASON,
    home_team_id: homeId,
    away_team_id: awayId,
    kickoff_at: kickoffUtc,
    original_kickoff_at: kickoffUtc,
    kickoff_london: kickoffToLondonIso(kickoffUtc),
    home_team_name: homeName,
    away_team_name: awayName,
  }
}

function main() {
  const extractPath = join(dataDir, 'official-extract.txt')
  const extract = readFileSync(extractPath, 'utf8')
  const fixtures: FixtureArtefactRow[] = []

  for (const line of extract.split('\n')) {
    const fixture = parseLine(line)
    if (fixture) fixtures.push(fixture)
  }

  const validation = validateFixtureArtefact(fixtures)
  const outPath = join(dataDir, 'fixtures.json')
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        meta: JSON.parse(readFileSync(join(dataDir, 'meta.json'), 'utf8')),
        teams: JSON.parse(readFileSync(join(dataDir, 'teams.json'), 'utf8')).teams,
        fixtures,
      },
      null,
      2,
    ),
  )

  console.log(`Wrote ${fixtures.length} fixtures to ${outPath}`)
  if (!validation.ok) {
    console.error('Validation failed:')
    for (const error of validation.errors) console.error(`  - ${error}`)
    process.exit(1)
  }
  console.log('Validation passed.')
}

main()
