import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FixtureArtefactRow } from './lib/fixtureValidation'
import { validateFixtureArtefact } from './lib/fixtureValidation'

const __dirname = dirname(fileURLToPath(import.meta.url))

const OFFICIAL_BASELINE_URL =
  'https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season/'

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function main() {
  const artefactPath = join(__dirname, '..', 'data', 'fixtures', '2026-27', 'fixtures.json')
  const artefact = JSON.parse(readFileSync(artefactPath, 'utf8')) as {
    meta: { source_retrieved_at: string }
    fixtures: FixtureArtefactRow[]
  }

  const validation = validateFixtureArtefact(artefact.fixtures)
  if (!validation.ok) {
    for (const error of validation.errors) console.error(error)
    process.exit(1)
  }

  const retrievedAt = artefact.meta.source_retrieved_at
  const lines: string[] = [
    'begin;',
    '',
    'insert into fixture_sync_runs (',
    '  source_type, source_url, validation_status, run_result, fixture_total, changes_detected',
    ') values (',
    "  'official_import',",
    `  ${sqlString(OFFICIAL_BASELINE_URL)},`,
    "  'passed',",
    "  'official_baseline_import',",
    '  380,',
    '  0',
    ');',
    '',
  ]

  for (const fixture of artefact.fixtures) {
    lines.push(
      'insert into season_fixtures (',
      '  season, source_fixture_id, canonical_key, home_team_id, away_team_id,',
      '  kickoff_at, original_kickoff_at, status, source_name, source_url, source_retrieved_at',
      ') values (',
      `  ${sqlString(fixture.season)},`,
      '  null,',
      `  ${sqlString(fixture.canonical_key)},`,
      `  ${sqlString(fixture.home_team_id)},`,
      `  ${sqlString(fixture.away_team_id)},`,
      `  ${sqlString(fixture.kickoff_at)}::timestamptz,`,
      `  ${sqlString(fixture.original_kickoff_at)}::timestamptz,`,
      "  'scheduled',",
      "  'premier_league_official',",
      `  ${sqlString(OFFICIAL_BASELINE_URL)},`,
      `  ${sqlString(retrievedAt)}::timestamptz`,
      ') on conflict (season, canonical_key) do nothing;',
      '',
    )
  }

  lines.push('commit;')

  const outDir = join(__dirname, 'generated')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'season-fixtures-import.sql')
  writeFileSync(outPath, lines.join('\n'), 'utf8')
  console.log(`Wrote ${artefact.fixtures.length} fixture inserts to ${outPath}`)
}

main()
