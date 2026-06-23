import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FixtureArtefactRow } from './lib/fixtureValidation'
import { validateFixtureArtefact } from './lib/fixtureValidation'

const __dirname = dirname(fileURLToPath(import.meta.url))

function main() {
  const artefactPath = join(__dirname, '..', 'data', 'fixtures', '2026-27', 'fixtures.json')
  const artefact = JSON.parse(readFileSync(artefactPath, 'utf8')) as { fixtures: FixtureArtefactRow[] }
  const validation = validateFixtureArtefact(artefact.fixtures)

  console.log('IMPORT DRY RUN')
  console.log('==============')
  console.log(`Fixtures ready for import: ${artefact.fixtures.length}`)
  console.log(`Validation: ${validation.ok ? 'PASSED' : 'FAILED'}`)

  if (!validation.ok) {
    for (const error of validation.errors) console.log(`  ERROR: ${error}`)
    process.exit(1)
  }

  console.log('\nNo database writes performed.')
  console.log('Production import requires CEO approval after reviewing this report.')
  console.log('\nSample INSERT shape (first fixture):')
  const sample = artefact.fixtures[0]
  console.log(
    JSON.stringify(
      {
        season: sample.season,
        canonical_key: sample.canonical_key,
        home_team_id: sample.home_team_id,
        away_team_id: sample.away_team_id,
        kickoff_at: sample.kickoff_at,
        original_kickoff_at: sample.original_kickoff_at,
        status: 'scheduled',
        source_name: 'premier_league_official',
      },
      null,
      2,
    ),
  )
}

main()
