import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validateFixtureArtefact, validateSampleWeekends, type FixtureArtefactRow } from '../scripts/lib/fixtureValidation'

const __dirname = dirname(fileURLToPath(import.meta.url))
const artefactPath = join(__dirname, '..', 'data', 'fixtures', '2026-27', 'fixtures.json')
const metaPath = join(__dirname, '..', 'data', 'fixtures', '2026-27', 'meta.json')

describe('official 2026/27 artefact', () => {
  it('validates when fixtures.json exists', () => {
    const artefact = JSON.parse(readFileSync(artefactPath, 'utf8')) as { fixtures: FixtureArtefactRow[] }
    const fixtures = artefact.fixtures

    const result = validateFixtureArtefact(fixtures)
    expect(result.stats.fixtureCount).toBe(380)
    expect(result.stats.teamCount).toBe(20)
    expect(result.ok).toBe(true)

    for (const teamId of Object.keys(result.stats.homeCounts)) {
      expect(result.stats.homeCounts[teamId]).toBe(19)
      expect(result.stats.awayCounts[teamId]).toBe(19)
    }

    expect(validateSampleWeekends(fixtures)).toEqual([])

    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as Record<string, string>
    expect(meta.source_name).toBe('premier_league_official')
    expect(meta.source_retrieved_at).toBeTruthy()
    expect(meta.validated_at).toBeTruthy()
    expect(meta.baseline_type).toBe('official_initial_schedule')
  })
})
