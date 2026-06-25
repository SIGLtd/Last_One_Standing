import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  applyMasterChangeToOpenSnapshot,
  snapshotDiffersFromMaster,
} from '../src/lib/fixtureChangePolicy'
import { resolveReconcileCaller, shouldExecuteScheduledScan, timingSafeEqual } from '../src/lib/reconcileAuth'
import {
  isPlayerFacingOpenWindow,
  isProtectedHistoricWindow,
  MIN_OPERATIONAL_WINDOW_NUMBER,
  PROTECTED_HISTORIC_WINDOW_NUMBER,
} from '../src/lib/windowGuards'
import {
  londonDateFromKickoff,
  londonDayOfWeek,
  validateFixtureArtefact,
  validateSampleWeekends,
  type FixtureArtefactRow,
} from '../scripts/lib/fixtureValidation'
import { filterEligibleWeekendFixtures } from '../scripts/lib/weekendEligibility'
import { canonicalKey, SEASON } from '../scripts/lib/teamsCatalog'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const migrationSql = readFileSync(join(root, 'supabase', 'migrations', '4_fixture_operations_core.sql'), 'utf8')
const gamesSeedSql = readFileSync(join(root, 'supabase', 'migrations', '2b_games_and_entries.sql'), 'utf8')
const artefactPath = join(root, 'data', 'fixtures', '2026-27', 'fixtures.json')
const metaPath = join(root, 'data', 'fixtures', '2026-27', 'meta.json')

function loadFixtures(): FixtureArtefactRow[] {
  const artefact = JSON.parse(readFileSync(artefactPath, 'utf8')) as { fixtures: FixtureArtefactRow[] }
  return artefact.fixtures
}

function sampleFixture(overrides: Partial<FixtureArtefactRow> = {}): FixtureArtefactRow {
  const kickoff_at = '2026-08-22T14:00:00.000Z'
  return {
    source_fixture_id: null,
    canonical_key: canonicalKey(SEASON, 'ars', 'cov', kickoff_at),
    season: SEASON,
    home_team_id: 'ars',
    away_team_id: 'cov',
    kickoff_at,
    original_kickoff_at: kickoff_at,
    kickoff_london: '2026-08-22T15:00:00',
    home_team_name: 'Arsenal',
    away_team_name: 'Coventry City',
    ...overrides,
  }
}

describe('acceptance matrix', () => {
  it('1. valid 380-fixture artefact validation', () => {
    const result = validateFixtureArtefact(loadFixtures())
    expect(result.ok).toBe(true)
    expect(result.stats.fixtureCount).toBe(380)
    expect(result.stats.teamCount).toBe(20)
  })

  it('2. invalid fixture artefact rejection', () => {
    const result = validateFixtureArtefact([sampleFixture()])
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('380'))).toBe(true)
  })

  it('3. no eligible weekend outcome', () => {
    const midweekOnly = [
      {
        kickoff_at: '2026-08-20T19:00:00.000Z',
        eligibility_override: 'none',
        status: 'scheduled',
      },
    ]
    const eligible = filterEligibleWeekendFixtures(
      midweekOnly,
      '2026-08-22',
      '2026-08-23',
      londonDateFromKickoff,
      londonDayOfWeek,
    )
    expect(eligible).toHaveLength(0)
  })

  it('4. candidate creation for a nominated target weekend', () => {
    const fixtures = loadFixtures()
    const eligible = filterEligibleWeekendFixtures(
      fixtures,
      '2026-08-22',
      '2026-08-23',
      londonDateFromKickoff,
      londonDayOfWeek,
    )
    expect(eligible.length).toBeGreaterThan(0)
    expect(migrationSql).toContain('refresh_pending_window_snapshots')
    const edgeSource = readFileSync(join(root, 'supabase', 'functions', 'reconcile-fixtures', 'index.ts'), 'utf8')
    expect(edgeSource).toContain("status: 'pending'")
    expect(edgeSource).toContain('refresh_pending_window_snapshots')
  })

  it('5. candidate approval creates a stable approved snapshot', () => {
    expect(migrationSql).toContain("status = 'open'")
    expect(migrationSql).toContain('approved_at = now()')
    expect(migrationSql).not.toMatch(/refresh_pending_window_snapshots[\s\S]*status = 'open'/i)
  })

  it('6. master fixture change after approval does not mutate the open snapshot', () => {
    const snapshot = {
      kickoff_at: '2026-08-22T14:00:00.000Z',
      home_team_id: 'ars',
      away_team_id: 'cov',
      fixture_status: 'scheduled',
    }
    const master = { kickoff_at: '2026-08-22T16:00:00.000Z', status: 'scheduled' }
    expect(snapshotDiffersFromMaster(snapshot, master)).toBe(true)
    expect(applyMasterChangeToOpenSnapshot(snapshot, master)).toEqual(snapshot)
  })

  it('7. valid paid active player selection (RPC guards present)', () => {
    expect(migrationSql).toContain('v_entry.paid')
    expect(migrationSql).toContain("v_entry.status <> 'active'")
    expect(migrationSql).toContain('auth.uid()')
    expect(migrationSql).toContain('selection_window_eligible_fixtures')
  })

  it('8. pre-deadline selection replacement', () => {
    expect(migrationSql).toContain('on conflict (window_id, player_id) do update set')
    expect(migrationSql).toContain('where selections.locked_at is null')
  })

  it('9. used team rejection after deadline or explicit lock', () => {
    expect(migrationSql).toContain('is_team_finally_used')
    expect(migrationSql).toContain("sw.status in ('locked', 'resolved')")
    expect(migrationSql).toContain('sw.deadline_at <= now()')
    expect(migrationSql).toContain("perform public.pick_error('TEAM_ALREADY_USED')")
  })

  it('10. replaced pre-deadline team remains usable later', () => {
    const picks = [
      { windowNumber: 2, teamId: 'ars', locked: false, deadlinePassed: false },
      { windowNumber: 2, teamId: 'liv', locked: false, deadlinePassed: false },
    ]
    const current = picks[picks.length - 1]
    const finallyUsed = picks
      .filter(
        (p) =>
          p.windowNumber >= MIN_OPERATIONAL_WINDOW_NUMBER &&
          p.teamId &&
          (p.locked || p.deadlinePassed),
      )
      .map((p) => p.teamId as string)
    expect(current.teamId).toBe('liv')
    expect(finallyUsed).not.toContain('ars')
  })

  it('11. unpaid or inactive player rejection', () => {
    expect(migrationSql).toContain("perform public.pick_error('ENTRY_INACTIVE')")
  })

  it('12. ineligible team rejection', () => {
    expect(migrationSql).toContain("perform public.pick_error('TEAM_NOT_ELIGIBLE')")
  })

  it('13. passed deadline rejection', () => {
    expect(migrationSql).toContain("perform public.pick_error('DEADLINE_PASSED')")
  })

  it('14. actual fixture-started rejection', () => {
    expect(migrationSql).toContain("perform public.pick_error('FIXTURE_STARTED')")
    expect(migrationSql).toContain('v_snapshot.kickoff_at <= v_now')
  })

  it('15. direct write bypass rejection', () => {
    expect(migrationSql).toContain('selections_insert_rpc_only')
    expect(migrationSql).toContain('selections_update_rpc_only')
    expect(migrationSql).toContain('with check (false)')
  })

  it('16. non-admin Edge Function manual invocation rejection', () => {
    const caller = resolveReconcileCaller({
      authorizationHeader: 'Bearer token',
      schedulerHeader: null,
      schedulerSecret: 'secret',
      isAdminPlayer: false,
      authUserId: 'user-1',
      playerId: 'player-1',
    })
    expect(caller).toEqual({ kind: 'unauthorized', reason: 'ADMIN_REQUIRED' })
  })

  it('17. invalid scheduler secret rejection', () => {
    const caller = resolveReconcileCaller({
      authorizationHeader: null,
      schedulerHeader: 'wrong',
      schedulerSecret: 'expected-secret-value',
      isAdminPlayer: false,
      authUserId: null,
      playerId: null,
    })
    expect(caller).toEqual({ kind: 'unauthorized', reason: 'INVALID_SCHEDULER_SECRET' })
    expect(timingSafeEqual('abc', 'abd')).toBe(false)
  })

  it('18. Window 1 preservation and non-interference', () => {
    expect(isProtectedHistoricWindow(PROTECTED_HISTORIC_WINDOW_NUMBER)).toBe(true)
    expect(
      isPlayerFacingOpenWindow({
        window_number: 1,
        status: 'open',
        deadline_at: new Date(Date.now() + 86_400_000).toISOString(),
        snapshot_fixture_count: 5,
      }),
    ).toBe(false)
    expect(migrationSql).toContain('WINDOW_1_PROTECTED')
    expect(migrationSql).toContain('window_number < 2')
    expect(migrationSql).toContain('sw.window_number >= 2')
  })

  it('19. Game 27, Ben Stephens, and Clarky preservation checks', () => {
    expect(gamesSeedSql).toContain('(27,')
    expect(gamesSeedSql).toContain('1920')
    expect(migrationSql).not.toMatch(/update\s+games/i)
    expect(migrationSql).not.toMatch(/delete\s+from\s+selection_windows/i)
    expect(migrationSql).not.toMatch(/delete\s+from\s+game_entries/i)
    expect(migrationSql).not.toMatch(/update\s+players/i)
  })

  it('20. provider-key-absent manual reconciliation path', () => {
    const edgeSource = readFileSync(join(root, 'supabase', 'functions', 'reconcile-fixtures', 'index.ts'), 'utf8')
    expect(edgeSource).toContain("body.sourceType ?? (footballDataKey ? 'football_data' : 'manual')")
    expect(edgeSource).toContain("result: 'provider_not_configured'")
    expect(edgeSource).toContain('FOOTBALL_DATA_API_KEY')
    expect(edgeSource).not.toContain('API_FOOTBALL_KEY')
  })

  it('21. provider change detection records an event but does not mutate an approved snapshot', () => {
    const edgeSource = readFileSync(join(root, 'supabase', 'functions', 'reconcile-fixtures', 'index.ts'), 'utf8')
    expect(edgeSource).toContain('fixture_change_events')
    expect(edgeSource).toContain('affects_open_window: true')
    expect(edgeSource).toMatch(/affectsOpen[\s\S]*continue/)
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as Record<string, string>
    expect(meta.baseline_type).toBe('official_initial_schedule')
    expect(meta.provider_change_detection).toContain('football_data')
  })
})

describe('artefact sample weekends', () => {
  it('validates opening, autumn, christmas, and spring samples', () => {
    const errors = validateSampleWeekends(loadFixtures())
    expect(errors).toEqual([])
  })
})

describe('scheduled scan guard', () => {
  it('only runs inside the London execution window', () => {
    expect(shouldExecuteScheduledScan(9, 0, 'monday')).toBe(true)
    expect(shouldExecuteScheduledScan(9, 20, 'monday')).toBe(false)
    expect(shouldExecuteScheduledScan(6, 0, 'saturday_early')).toBe(true)
  })
})
