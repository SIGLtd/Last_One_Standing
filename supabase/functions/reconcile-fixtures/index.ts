import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { DateTime } from 'https://esm.sh/luxon@3.5.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-los-scheduler-secret',
}

type ReconcileBody = {
  action?: 'reconcile' | 'status'
  targetSatDate?: string
  targetSunDate?: string
  sourceType?: 'manual' | 'api_football'
  schedule?: 'monday' | 'friday' | 'saturday_early'
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
  | { kind: 'unauthorized'; reason: string }

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const apiFootballKey = Deno.env.get('API_FOOTBALL_KEY')
    const admin = createClient(supabaseUrl, serviceKey)

    const caller = await resolveCaller(req, admin)
    if (caller.kind === 'unauthorized') return json({ error: caller.reason }, caller.reason === 'ADMIN_REQUIRED' ? 403 : 401)

    const body = (await req.json().catch(() => ({}))) as ReconcileBody

    if (body.action === 'status' || req.method === 'GET') {
      if (caller.kind !== 'admin') return json({ error: 'ADMIN_REQUIRED' }, 403)
      return json({
        providerConfigured: Boolean(apiFootballKey),
        schedulerConfigured: Boolean(Deno.env.get('LOS_SCHEDULER_SECRET')),
      })
    }

    if (caller.kind === 'scheduler') {
      const nowLondon = DateTime.now().setZone('Europe/London')
      const schedule = body.schedule ?? 'monday'
      if (!shouldExecuteScheduledScan(nowLondon.hour, nowLondon.minute, schedule)) {
        return json({ result: 'schedule_guard_skipped', schedule })
      }
      if (!apiFootballKey) {
        return json({ result: 'provider_not_configured' })
      }
    }

    const sourceType =
      caller.kind === 'scheduler'
        ? 'api_football'
        : body.sourceType ?? (apiFootballKey ? 'api_football' : 'manual')

    const weekend =
      body.targetSatDate && body.targetSunDate
        ? { sat: body.targetSatDate, sun: body.targetSunDate }
        : nextLondonWeekend()

    const { data: game } = await admin.from('games').select('*').eq('game_number', 27).maybeSingle()
    if (!game || !['open', 'in_progress'].includes(game.status)) {
      return json({ result: 'game_not_live', weekend })
    }

    const { data: syncRun, error: syncError } = await admin
      .from('fixture_sync_runs')
      .insert({
        source_type: sourceType,
        source_url:
          sourceType === 'api_football'
            ? 'https://v3.football.api-sports.io'
            : 'https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season/',
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

    if (sourceType === 'api_football' && apiFootballKey) {
      const response = await fetch('https://v3.football.api-sports.io/fixtures?league=39&season=2026', {
        headers: { 'x-apisports-key': apiFootballKey },
      })
      if (!response.ok) {
        await admin
          .from('fixture_sync_runs')
          .update({
            validation_status: 'failed',
            run_result: 'source_failed',
            error_summary: `API Football HTTP ${response.status}`,
          })
          .eq('id', syncRun.id)
        return json({ result: 'source_failed', syncRunId: syncRun.id })
      }

      const payload = await response.json()
      for (const item of payload.response ?? []) {
        const fixture = item.fixture
        const teams = item.teams
        const homeCode = mapApiTeamToId(teams.home.name)
        const awayCode = mapApiTeamToId(teams.away.name)
        if (!homeCode || !awayCode) continue

        const kickoff = fixture.date
        const canonical = `2026/27|${homeCode}|${awayCode}|${londonDate(kickoff)}`
        const { data: existing } = await admin
          .from('season_fixtures')
          .select('*')
          .eq('season', '2026/27')
          .eq('canonical_key', canonical)
          .maybeSingle()

        const status = mapApiStatus(fixture.status.short)
        const { data: openWindows } = await admin
          .from('selection_windows')
          .select('id')
          .eq('game_id', game.id)
          .eq('status', 'open')
          .gte('window_number', 2)

        const affectsOpen =
          (openWindows ?? []).length > 0 &&
          existing &&
          (existing.kickoff_at !== kickoff || existing.status !== status)

        if (affectsOpen) {
          await admin.from('fixture_change_events').insert({
            sync_run_id: syncRun.id,
            season_fixture_id: existing.id,
            change_type: existing.kickoff_at !== kickoff ? 'kickoff_change' : 'status_change',
            old_values: { kickoff_at: existing.kickoff_at, status: existing.status },
            new_values: { kickoff_at: kickoff, status },
            affects_open_window: true,
            affected_window_id: openWindows?.[0]?.id ?? null,
          })
          changesDetected += 1
          continue
        }

        const row = {
          season: '2026/27',
          source_fixture_id: String(fixture.id),
          canonical_key: canonical,
          home_team_id: homeCode,
          away_team_id: awayCode,
          kickoff_at: kickoff,
          original_kickoff_at: existing?.original_kickoff_at ?? kickoff,
          status,
          source_name: 'api_football',
          source_url: 'https://v3.football.api-sports.io',
          source_retrieved_at: new Date().toISOString(),
          last_changed_at:
            existing && existing.kickoff_at !== kickoff ? new Date().toISOString() : existing?.last_changed_at,
          rescheduled_count:
            existing && existing.kickoff_at !== kickoff
              ? (existing.rescheduled_count ?? 0) + 1
              : (existing?.rescheduled_count ?? 0),
        }

        const { error: upsertError } = await admin.from('season_fixtures').upsert(row, { onConflict: 'season,canonical_key' })
        if (!upsertError) masterUpdated += 1
        if (existing && (existing.kickoff_at !== kickoff || existing.status !== status)) {
          changesDetected += 1
          await admin.from('fixture_change_events').insert({
            sync_run_id: syncRun.id,
            season_fixture_id: existing.id,
            change_type: existing.kickoff_at !== kickoff ? 'kickoff_change' : 'status_change',
            old_values: { kickoff_at: existing.kickoff_at, status: existing.status },
            new_values: { kickoff_at: kickoff, status },
            affects_open_window: false,
          })
        }
      }
    }

    const { data: masterFixtures } = await admin.from('season_fixtures').select('*').eq('season', '2026/27')

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
      providerConfigured: Boolean(apiFootballKey),
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

function mapApiStatus(short: string): string {
  const map: Record<string, string> = {
    NS: 'scheduled',
    TBD: 'scheduled',
    PST: 'postponed',
    CANC: 'cancelled',
    '1H': 'in_play',
    HT: 'in_play',
    '2H': 'in_play',
    FT: 'finished',
    AET: 'finished',
    PEN: 'finished',
  }
  return map[short] ?? 'scheduled'
}

function mapApiTeamToId(name: string): string | null {
  const map: Record<string, string> = {
    Arsenal: 'ars',
    'Aston Villa': 'avl',
    Bournemouth: 'bou',
    'AFC Bournemouth': 'bou',
    Brentford: 'bre',
    Brighton: 'bha',
    'Brighton and Hove Albion': 'bha',
    Chelsea: 'che',
    'Coventry City': 'cov',
    'Crystal Palace': 'cry',
    Everton: 'eve',
    Fulham: 'ful',
    'Hull City': 'hul',
    'Ipswich Town': 'ips',
    'Leeds United': 'lee',
    Leeds: 'lee',
    Liverpool: 'liv',
    'Manchester City': 'mci',
    'Manchester United': 'mun',
    'Newcastle United': 'new',
    Newcastle: 'new',
    'Nottingham Forest': 'nfo',
    Sunderland: 'sun',
    'Tottenham Hotspur': 'tot',
    Tottenham: 'tot',
  }
  return map[name] ?? null
}
