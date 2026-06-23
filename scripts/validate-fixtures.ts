import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateFixtureArtefact, type FixtureArtefactRow } from './lib/fixtureValidation'

const __dirname = dirname(fileURLToPath(import.meta.url))
const artefactPath = join(__dirname, '..', 'data', 'fixtures', '2026-27', 'fixtures.json')

function main() {
  const artefact = JSON.parse(readFileSync(artefactPath, 'utf8')) as { fixtures: FixtureArtefactRow[] }
  const result = validateFixtureArtefact(artefact.fixtures)

  console.log('Fixture validation report')
  console.log('========================')
  console.log(`Fixture count: ${result.stats.fixtureCount}`)
  console.log(`Team count: ${result.stats.teamCount}`)
  console.log(`Valid: ${result.ok ? 'YES' : 'NO'}`)

  if (result.errors.length > 0) {
    console.log('\nErrors:')
    for (const error of result.errors) console.log(`  - ${error}`)
  }
  if (result.warnings.length > 0) {
    console.log('\nWarnings:')
    for (const warning of result.warnings) console.log(`  - ${warning}`)
  }

  process.exit(result.ok ? 0 : 1)
}

main()
