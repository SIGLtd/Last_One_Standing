import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FixtureArtefactRow } from './lib/fixtureValidation'
import { validateFixtureArtefact } from './lib/fixtureValidation'
import { loadLocalEnv, requireEnv } from './lib/loadLocalEnv'

const __dirname = dirname(fileURLToPath(import.meta.url))

const OFFICIAL_BASELINE_URL =
  'https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season/'

const BATCH_SIZE = 50

async function main() {
  loadLocalEnv()
  const dryRun = process.argv.includes('--dry-run')
  const supabaseUrl = requireEnv('SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const artefactPath = join(__dirname, '..', 'data', 'fixtures', '2026-27', 'fixtures.json')
  const artefact = JSON.parse(readFileSync(artefactPath, 'utf8')) as {
    meta: { source_retrieved_at: string }
    fixtures: FixtureArtefactRow[]
  }

  const validation = validateFixtureArtefact(artefact.fixtures)
  console.log('IMPORT GATE')
  console.log('===========')
  console.log(`Fixture count: ${artefact.fixtures.length}`)
  console.log(`Validation: ${validation.ok ? 'PASSED' : 'FAILED'}`)
  if (!validation.ok) {
    for (const error of validation.errors) console.log(`  ERROR: ${error}`)
    process.exit(1)
  }

  const admin = createClient(supabaseUrl, serviceKey)

  const { count: existingCount, error: countError } = await admin
    .from('season_fixtures')
    .select('*', { count: 'exact', head: true })
    .eq('season', '2026/27')

  if (countError) throw countError
  console.log(`Existing season_fixtures rows: ${existingCount ?? 0}`)

  if ((existingCount ?? 0) > 0 && (existingCount ?? 0) !== 380) {
    console.error(
      `Unexpected existing row count ${existingCount}. Aborting to avoid partial overwrite.`,
    )
    process.exit(1)
  }

  if ((existingCount ?? 0) === 380) {
    console.log('Baseline already imported (380 rows). Skipping inserts.')
    process.exit(0)
  }

  if (dryRun) {
    console.log('\nDry run complete. No database writes performed.')
    process.exit(0)
  }

  const { data: syncRun, error: syncRunError } = await admin
    .from('fixture_sync_runs')
    .insert({
      source_type: 'official_import',
      source_url: OFFICIAL_BASELINE_URL,
      validation_status: 'passed',
      run_result: 'official_baseline_import',
      fixture_total: artefact.fixtures.length,
      changes_detected: 0,
    })
    .select('id')
    .single()

  if (syncRunError) throw syncRunError

  const retrievedAt = artefact.meta.source_retrieved_at ?? new Date().toISOString()
  let inserted = 0
  let skipped = 0

  for (let i = 0; i < artefact.fixtures.length; i += BATCH_SIZE) {
    const batch = artefact.fixtures.slice(i, i + BATCH_SIZE).map((fixture) => ({
      season: fixture.season,
      source_fixture_id: fixture.source_fixture_id,
      canonical_key: fixture.canonical_key,
      home_team_id: fixture.home_team_id,
      away_team_id: fixture.away_team_id,
      kickoff_at: fixture.kickoff_at,
      original_kickoff_at: fixture.original_kickoff_at,
      status: 'scheduled' as const,
      source_name: 'premier_league_official',
      source_url: OFFICIAL_BASELINE_URL,
      source_retrieved_at: retrievedAt,
      import_batch_id: syncRun.id,
    }))

    const { data, error } = await admin
      .from('season_fixtures')
      .upsert(batch, { onConflict: 'season,canonical_key', ignoreDuplicates: true })
      .select('id')

    if (error) throw error
    inserted += data?.length ?? 0
    skipped += batch.length - (data?.length ?? 0)
  }

  console.log(`\nImport batch id: ${syncRun.id}`)
  console.log(`Rows inserted: ${inserted}`)
  console.log(`Rows skipped (already present): ${skipped}`)

  const mapResponse = await fetch(`${supabaseUrl}/functions/v1/reconcile-fixtures`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'map_provider_ids' }),
  })

  const mapPayload = await mapResponse.json().catch(() => ({}))
  console.log('\nProvider ID mapping:', JSON.stringify(mapPayload, null, 2))

  const { count: finalCount } = await admin
    .from('season_fixtures')
    .select('*', { count: 'exact', head: true })
    .eq('season', '2026/27')

  console.log(`\nFinal season_fixtures count: ${finalCount ?? 0}`)
  if ((finalCount ?? 0) !== 380) {
    console.error('Import incomplete: expected 380 rows.')
    process.exit(1)
  }

  console.log('\nBaseline import complete.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
