import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { DateTime } from 'https://esm.sh/luxon@3.5.0'
import {
  checkFootballDataReadiness,
  FOOTBALL_DATA_API_BASE,
  loadNormalizedSeasonMatches,
  LOS_SEASON_LABEL,
  PL_COMPETITION_CODE,
  type NormalizedProviderMatch,
} from './footballDataProvider.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-los-scheduler-secret',
}

const OFFICIAL_BASELINE_URL =
  'https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season/'

type ReconcileBody = {
  action?: 'reconcile' | 'status' | 'provider_check' | 'provider_sync' | 'map_provider_ids'
  targetSatDate?: string
  targetSunDate?: string
  sourceType?: 'manual' | 'football_data'
  schedule?: 'monday' | 'friday' | 'saturday_early'
  createCandidateWindow?: boolean
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

function nextLondonWeekend(from = DateTime.now().setZone('Europe/London')): { sat: string; sun: string } {
  let cursor = from.startOf('day')
  while (cursor.weekday !== 6) cursor = cursor.plus({ days: 1 })
  return { sat: cursor.toISODate()!, sun: cursor.plus({ days: 1 }).toISODate()! }
}

function londonDate(iso: string): string {
  return DateTime.fromISO(iso, { zone: 'utc' }).setZone('Europe/London').toISODate()!
}

function londonIsodow(iso: string): number {
  return DateTime.fromISO(iso, { zone: 'utc' }).setZone('Europe/London').weekday
}

function isStandardEligible(kickoff: string, override: string, status: string): boolean {
  if (override === 'force_ineligible') return false
  if (override === 'force_eligible') return ['scheduled', 'in_play'].includes(status)
  return ['scheduled', 'in_play'].includes(status) && [6, 7].includes(londonIsodow(kickoff))
}

function shouldExecuteScheduledScan(
  londonHour: number,
  londonMinute: number,
  schedule: 'monday' | 'friday' | 'saturday_early',
): boolean {
  switch (schedule) {
    case 'monday':
    case 'friday':
      return londonHour === 9 && londonMinute < 15
    case 'saturday_early':
      return londonHour === 6 && londonMinute < 15
  }
}

type Caller =
  | { kind: 'admin'; playerId: string }
  | { kind: 'scheduler' }
  | { kind: 'service' }
  | { kind: 'unauthorized'; reason: string }

function isServiceRoleBearer(token: string): boolean {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? ''
  if (serviceKey && timingSafeEqual(token, serviceKey)) return true

  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

async function resolveCaller(req: Request, admin: ReturnType<typeof createClient>): Promise<Caller> {
  const schedulerSecret = Deno.env.get('LOS_SCHEDULER_SECRET')?.trim() ?? ''
  const providedSecret = req.headers.get('x-los-scheduler-secret')?.trim() ?? ''

  if (schedulerSecret && providedSecret) {
    if (!timingSafeEqual(schedulerSecret, providedSecret)) {
      return { kind: 'unauthorized', reason: 'INVALID_SCHEDULER_SECRET' }
    }
    return { kind: 'scheduler' }
  }

  if (providedSecret) {
    return { kind: 'unauthorized', reason: 'INVALID_SCHEDULER_SECRET' }
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { kind: 'unauthorized', reason: 'UNAUTHORIZED' }
  }

  const token = authHeader.slice(7)
  if (isServiceRoleBearer(token)) {
    return { kind: 'service' }
  }

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return { kind: 'unauthorized', reason: 'UNAUTHORIZED' }

  const { data: player } = await admin
    .from('players')
    .select('id, is_admin')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (!player?.is_admin) return { kind: 'unauthorized', reason: 'ADMIN_REQUIRED' }
  return { kind: 'admin', playerId: player.id }
}

type ProviderSyncResult = {
  changesDetected: number
  masterUpdated: number
  providerMapped: number
}

async function applyProviderMatches(
  admin: ReturnType<typeof createClient>,
  syncRunId: string,
  gameId: string,
  providerMatches: NormalizedProviderMatch[],
): Promise<ProviderSyncResult> {
  let changesDetected = 0
  let masterUpdated = 0
  let providerMapped = 0

  for (const item of providerMatches) {
    const { data: existing } = await admin
      .from('season_fixtures')
      .select('*')
      .eq('season', LOS_SEASON_LABEL)
      .eq('canonical_key', item.canonicalKey)
      .maybeSingle()

    if (!existing) continue

    const kickoff = item.kickoffAt
    const status = item.status

    const { data: openWindows } = await admin
      .from('selection_windows')
      .select('id')
      .eq('game_id', gameId)
      .eq('status', 'open')
      .gte('window_number', 2)

    const kickoffChanged = existing.kickoff_at !== kickoff
    const statusChanged = existing.status !== status
    const scoreChanged =
      item.homeScore != null &&
      item.awayScore != null &&
      (existing.home_score !== item.homeScore || existing.away_score !== item.awayScore)

    const affectsOpen =
      (openWindows ?? []).length > 0 && existing && (kickoffChanged || statusChanged)

    if (affectsOpen) {
      await admin.from('fixture_change_events').insert({
        sync_run_id: syncRunId,
        season_fixture_id: existing.id,
        change_type: kickoffChanged ? 'kickoff_change' : 'status_change',
        old_values: {
          kickoff_at: existing.kickoff_at,
          status: existing.status,
          home_score: existing.home_score,
          away_score: existing.away_score,
        },
        new_values: {
          kickoff_at: kickoff,
          status,
          home_score: item.homeScore,
          away_score: item.awayScore,
        },
        affects_open_window: true,
        affected_window_id: openWindows?.[0]?.id ?? null,
      })
      changesDetected += 1
      continue
    }

    const shouldMapProviderId = !existing.source_fixture_id && item.providerFixtureId
    const row = {
      season: LOS_SEASON_LABEL,
      source_fixture_id: existing.source_fixture_id ?? item.providerFixtureId,
      canonical_key: item.canonicalKey,
      home_team_id: item.homeTeamId,
      away_team_id: item.awayTeamId,
      kickoff_at: kickoff,
      original_kickoff_at: existing.original_kickoff_at ?? kickoff,
      status,
      home_score: item.homeScore ?? existing.home_score,
      away_score: item.awayScore ?? existing.away_score,
      result_status: item.resultStatus !== 'pending' ? item.resultStatus : existing.result_status,
      source_name: existing.source_name === 'premier_league_official' ? existing.source_name : 'football_data',
      source_url: `${FOOTBALL_DATA_API_BASE}/competitions/${PL_COMPETITION_CODE}/matches`,
      source_retrieved_at: new Date().toISOString(),
      last_changed_at:
        existing && (kickoffChanged || statusChanged || scoreChanged)
          ? new Date().toISOString()
          : existing?.last_changed_at,
      rescheduled_count:
        existing && kickoffChanged ? (existing.rescheduled_count ?? 0) + 1 : (existing?.rescheduled_count ?? 0),
    }

    const { error: upsertError } = await admin.from('season_fixtures').upsert(row, { onConflict: 'season,canonical_key' })
    if (!upsertError) {
      masterUpdated += 1
      if (shouldMapProviderId) providerMapped += 1
    }

    if (existing && (kickoffChanged || statusChanged || scoreChanged)) {
      changesDetected += 1
      const changeType = kickoffChanged
        ? 'kickoff_change'
        : status === 'postponed'
          ? 'postponed'
          : status === 'cancelled'
            ? 'cancelled'
            : 'status_change'

      await admin.from('fixture_change_events').insert({
        sync_run_id: syncRunId,
        season_fixture_id: existing.id,
        change_type: changeType,
        old_values: {
          kickoff_at: existing.kickoff_at,
          status: existing.status,
          home_score: existing.home_score,
          away_score: existing.away_score,
        },
        new_values: {
          kickoff_at: kickoff,
          status,
          home_score: item.homeScore,
          away_score: item.awayScore,
        },
        affects_open_window: false,
      })
    }
  }

  return { changesDetected, masterUpdated, providerMapped }
}

async function mapProviderIdsOnly(
  admin: ReturnType<typeof createClient>,
  providerMatches: NormalizedProviderMatch[],
): Promise<{ mapped: number; skipped: number }> {
  let mapped = 0
  let skipped = 0

  for (const item of providerMatches) {
    const { data: existing } = await admin
      .from('season_fixtures')
      .select('id, source_fixture_id, canonical_key')
      .eq('season', LOS_SEASON_LABEL)
      .eq('canonical_key', item.canonicalKey)
      .maybeSingle()

    if (!existing) {
      skipped += 1
      continue
    }
    if (existing.source_fixture_id) {
      skipped += 1
      continue
    }

    const { error } = await admin
      .from('season_fixtures')
      .update({
        source_fixture_id: item.providerFixtureId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .is('source_fixture_id', null)

    if (!error) mapped += 1
    else skipped += 1
  }

  return { mapped, skipped }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const footballDataKey = Deno.env.get('FOOTBALL_DATA_API_KEY')?.trim() ?? ''
    const admin = createClient(supabaseUrl, serviceKey)

    const caller = await resolveCaller(req, admin)
    if (caller.kind === 'unauthorized') return json({ error: caller.reason }, caller.reason === 'ADMIN_REQUIRED' ? 403 : 401)

    const body = (await req.json().catch(() => ({}))) as ReconcileBody
    const action = body.action ?? (req.method === 'GET' ? 'status' : 'reconcile')

    if (action === 'status' || req.method === 'GET') {
      if (caller.kind !== 'admin' && caller.kind !== 'service') return json({ error: 'ADMIN_REQUIRED' }, 403)
      return json({
        providerConfigured: Boolean(footballDataKey),
        provider: 'football-data.org',
        schedulerConfigured: Boolean(Deno.env.get('LOS_SCHEDULER_SECRET')),
      })
    }

    if (action === 'provider_check') {
      if (caller.kind !== 'admin' && caller.kind !== 'service') return json({ error: 'ADMIN_REQUIRED' }, 403)
      if (!footballDataKey) return json({ result: 'provider_not_configured' })
      const readiness = await checkFootballDataReadiness(footballDataKey)
      return json({
        result: readiness.keyAccepted ? 'ready' : 'provider_auth_failed',
        endpointStrategy: {
          competition: `${FOOTBALL_DATA_API_BASE}/competitions/${PL_COMPETITION_CODE}`,
          seasonMatches: `${FOOTBALL_DATA_API_BASE}/competitions/${PL_COMPETITION_CODE}/matches?season=${LOS_SEASON_LABEL.slice(0, 4)}`,
          authHeader: 'X-Auth-Token',
        },
        readiness,
      })
    }

    if (action === 'map_provider_ids') {
      if (caller.kind !== 'admin' && caller.kind !== 'service') return json({ error: 'ADMIN_REQUIRED' }, 403)
      if (!footballDataKey) return json({ result: 'provider_not_configured' })

      const providerMatches = await loadNormalizedSeasonMatches(footballDataKey)
      const mapping = await mapProviderIdsOnly(admin, providerMatches)
      return json({
        result: 'provider_ids_mapped',
        providerMatchCount: providerMatches.length,
        ...mapping,
      })
    }

    if (caller.kind === 'scheduler') {
      const nowLondon = DateTime.now().setZone('Europe/London')
      const schedule = body.schedule ?? 'monday'
      if (!shouldExecuteScheduledScan(nowLondon.hour, nowLondon.minute, schedule)) {
        return json({ result: 'schedule_guard_skipped', schedule })
      }
      if (!footballDataKey) {
        return json({ result: 'provider_not_configured' })
      }
    }

    const sourceType =
      caller.kind === 'scheduler'
        ? 'football_data'
        : body.sourceType ?? (footballDataKey ? 'football_data' : 'manual')

    const weekend =
      body.targetSatDate && body.targetSunDate
        ? { sat: body.targetSatDate, sun: body.targetSunDate }
        : nextLondonWeekend()

    const { data: game } = await admin.from('games').select('*').eq('game_number', 27).maybeSingle()
    if (!game || !['open', 'in_progress'].includes(game.status)) {
      return json({ result: 'game_not_live', weekend })
    }

    const createCandidateWindow = action === 'reconcile' && body.createCandidateWindow !== false

    const { data: syncRun, error: syncError } = await admin
      .from('fixture_sync_runs')
      .insert({
        source_type: sourceType,
        source_url:
          sourceType === 'football_data'
            ? `${FOOTBALL_DATA_API_BASE}/competitions/${PL_COMPETITION_CODE}/matches`
            : OFFICIAL_BASELINE_URL,
        validation_status: 'running',
        run_result: 'running',
        game_id: game.id,
        target_sat_date: weekend.sat,
        target_sun_date: weekend.sun,
        created_by_player_id: caller.kind === 'admin' ? caller.playerId : null,
      })
      .select('*')
      .single()

    if (syncError) throw syncError

    let changesDetected = 0
    let masterUpdated = 0
    let providerMapped = 0

    if (sourceType === 'football_data' && footballDataKey) {
      const providerMatches = await loadNormalizedSeasonMatches(footballDataKey)
      if (providerMatches.length === 0) {
        await admin
          .from('fixture_sync_runs')
          .update({
            validation_status: 'failed',
            run_result: 'source_empty',
            error_summary: 'football-data.org returned no normalised matches for season',
          })
          .eq('id', syncRun.id)
        return json({ result: 'source_empty', syncRunId: syncRun.id })
      }

      const syncResult = await applyProviderMatches(admin, syncRun.id, game.id, providerMatches)
      changesDetected = syncResult.changesDetected
      masterUpdated = syncResult.masterUpdated
      providerMapped = syncResult.providerMapped
    }

    if (action === 'provider_sync' || !createCandidateWindow) {
      await admin
        .from('fixture_sync_runs')
        .update({
          validation_status: 'passed',
          run_result: 'provider_sync_complete',
          fixture_total: masterUpdated,
          changes_detected: changesDetected,
          error_summary: providerMapped > 0 ? `provider_ids_mapped:${providerMapped}` : null,
        })
        .eq('id', syncRun.id)

      return json({
        result: 'provider_sync_complete',
        weekend,
        masterUpdated,
        changesDetected,
        providerMapped,
        syncRunId: syncRun.id,
        providerConfigured: Boolean(footballDataKey),
      })
    }

    const { data: masterFixtures } = await admin.from('season_fixtures').select('*').eq('season', LOS_SEASON_LABEL)

    const eligible = (masterFixtures ?? []).filter(
      (f) =>
        londonDate(f.kickoff_at) >= weekend.sat &&
        londonDate(f.kickoff_at) <= weekend.sun &&
        isStandardEligible(f.kickoff_at, f.eligibility_override, f.status),
    )

    const { data: unresolved } = await admin
      .from('selection_windows')
      .select('id')
      .eq('game_id', game.id)
      .gte('window_number', 2)
      .in('status', ['pending', 'open', 'locked', 'resolving'])
      .eq('eligible_sat_date', weekend.sat)
      .eq('eligible_sun_date', weekend.sun)
      .is('review_outcome', null)

    if (unresolved && unresolved.length > 0) {
      await admin
        .from('fixture_sync_runs')
        .update({
          validation_status: 'passed',
          run_result: 'window_already_exists',
          fixture_total: eligible.length,
          changes_detected: changesDetected,
        })
        .eq('id', syncRun.id)
      return json({ result: 'window_already_exists', weekend, eligibleCount: eligible.length, syncRunId: syncRun.id })
    }

    if (eligible.length === 0) {
      await admin
        .from('fixture_sync_runs')
        .update({
          validation_status: 'passed',
          run_result: 'no_eligible_weekend',
          fixture_total: 0,
          changes_detected: changesDetected,
        })
        .eq('id', syncRun.id)
      return json({ result: 'no_eligible_weekend', weekend, syncRunId: syncRun.id })
    }

    const teamCounts = new Map<string, number>()
    for (const f of eligible) {
      teamCounts.set(f.home_team_id, (teamCounts.get(f.home_team_id) ?? 0) + 1)
      teamCounts.set(f.away_team_id, (teamCounts.get(f.away_team_id) ?? 0) + 1)
    }
    const duplicateTeams = [...teamCounts.entries()].filter(([, c]) => c > 1).map(([t]) => t)

    const { data: maxWindow } = await admin
      .from('selection_windows')
      .select('window_number')
      .eq('game_id', game.id)
      .order('window_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextWindowNumber = Math.max(2, (maxWindow?.window_number ?? 1) + 1)
    const earliest = eligible.reduce((min, f) => (f.kickoff_at < min ? f.kickoff_at : min), eligible[0].kickoff_at)
    const deadline = DateTime.fromISO(earliest, { zone: 'utc' }).minus({ hours: 1 }).toUTC().toISO()!

    const { data: existingPending } = await admin
      .from('selection_windows')
      .select('*')
      .eq('game_id', game.id)
      .eq('status', 'pending')
      .gte('window_number', 2)
      .eq('eligible_sat_date', weekend.sat)
      .eq('eligible_sun_date', weekend.sun)
      .is('review_outcome', null)
      .maybeSingle()

    let pendingWindow = existingPending

    if (!pendingWindow) {
      const { data: inserted, error: windowError } = await admin
        .from('selection_windows')
        .insert({
          game_id: game.id,
          window_number: nextWindowNumber,
          status: 'pending',
          eligible_sat_date: weekend.sat,
          eligible_sun_date: weekend.sun,
          earliest_kickoff_at: earliest,
          deadline_at: deadline,
          start_at: DateTime.fromISO(earliest, { zone: 'utc' }).minus({ days: 2 }).toISO()!,
          end_at: DateTime.fromISO(earliest, { zone: 'utc' }).plus({ days: 2 }).toISO()!,
          sync_run_id: syncRun.id,
          review_outcome: null,
        })
        .select('*')
        .single()
      if (windowError) throw windowError
      pendingWindow = inserted
    } else {
      await admin
        .from('selection_windows')
        .update({
          earliest_kickoff_at: earliest,
          deadline_at: deadline,
          sync_run_id: syncRun.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pendingWindow.id)
    }

    await admin.rpc('refresh_pending_window_snapshots', { p_window_id: pendingWindow.id })

    await admin
      .from('fixture_sync_runs')
      .update({
        validation_status: duplicateTeams.length > 0 ? 'failed' : 'passed',
        run_result: duplicateTeams.length > 0 ? 'duplicate_team_in_candidate' : 'candidate_created',
        fixture_total: eligible.length,
        changes_detected: changesDetected,
        error_summary: duplicateTeams.length > 0 ? `Duplicate teams: ${duplicateTeams.join(', ')}` : null,
      })
      .eq('id', syncRun.id)

    return json({
      result: duplicateTeams.length > 0 ? 'duplicate_team_in_candidate' : 'candidate_created',
      weekend,
      eligibleCount: eligible.length,
      duplicateTeams,
      windowId: pendingWindow.id,
      windowNumber: pendingWindow.window_number,
      deadline,
      masterUpdated,
      changesDetected,
      syncRunId: syncRun.id,
      providerConfigured: Boolean(footballDataKey),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json({ error: message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export { shouldExecuteScheduledScan, timingSafeEqual }
