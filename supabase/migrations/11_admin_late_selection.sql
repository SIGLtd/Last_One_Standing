-- Admin late-pick override after deadline.
-- Does not change submit_selection, Round 1 outcomes, fixtures, payments, or pot.

create or replace function public.admin_submit_late_selection(
  p_player_id uuid,
  p_window_id uuid,
  p_team_id text,
  p_reason text
)
returns selections
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_entry game_entries%rowtype;
  v_window selection_windows%rowtype;
  v_fixture season_fixtures%rowtype;
  v_snapshot selection_window_eligible_fixtures%rowtype;
  v_selection selections%rowtype;
  v_reason text;
  v_now timestamptz := now();
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select id into v_actor from players where user_id = auth.uid();
  if v_actor is null then
    perform public.pick_error('PLAYER_NOT_FOUND');
  end if;

  if not exists (select 1 from players where id = p_player_id) then
    perform public.pick_error('PLAYER_NOT_FOUND');
  end if;

  v_reason := trim(coalesce(p_reason, ''));
  if char_length(v_reason) < 8 then
    perform public.pick_error('LATE_REASON_REQUIRED');
  end if;

  select * into v_window from selection_windows where id = p_window_id;
  if v_window.id is null then
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;

  if v_window.window_number < 2 then
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;

  if v_window.status in ('resolved', 'resolving') then
    perform public.pick_error('ROUND_ALREADY_RESOLVED');
  end if;

  if v_window.status not in ('open', 'locked') then
    perform public.pick_error('NO_ACTIVE_WINDOW');
  end if;

  select * into v_entry
  from game_entries
  where player_id = p_player_id
    and game_id = v_window.game_id;

  if v_entry.id is null or not v_entry.paid or v_entry.status <> 'active' then
    perform public.pick_error('ENTRY_INACTIVE');
  end if;

  select * into v_snapshot
  from selection_window_eligible_fixtures
  where window_id = p_window_id
    and (home_team_id = p_team_id or away_team_id = p_team_id)
  order by kickoff_at asc
  limit 1;

  if v_snapshot.id is null then
    perform public.pick_error('TEAM_NOT_ELIGIBLE');
  end if;

  if public.is_team_finally_used(v_window.game_id, p_player_id, p_team_id) then
    perform public.pick_error('TEAM_ALREADY_USED');
  end if;

  select * into v_fixture from season_fixtures where id = v_snapshot.season_fixture_id;

  insert into selections (
    game_id, window_id, player_id, team_id, season_fixture_id, locked_at,
    admin_corrected, corrected_by, correction_reason
  ) values (
    v_window.game_id, p_window_id, p_player_id, p_team_id, v_fixture.id, null,
    true, v_actor, v_reason
  )
  on conflict (window_id, player_id) do update set
    team_id = excluded.team_id,
    season_fixture_id = excluded.season_fixture_id,
    admin_corrected = true,
    corrected_by = excluded.corrected_by,
    correction_reason = excluded.correction_reason,
    updated_at = now()
  returning * into v_selection;

  if v_selection.id is null then
    perform public.pick_error('WINDOW_LOCKED');
  end if;

  return v_selection;
end;
$$;

revoke all on function public.admin_submit_late_selection(uuid, uuid, text, text) from public;
grant execute on function public.admin_submit_late_selection(uuid, uuid, text, text) to authenticated;
