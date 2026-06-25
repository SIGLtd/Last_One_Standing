-- Create Game 27 Window 2 as a pending draft (idempotent).
-- Does not approve, open, lock, or create player selections.
-- Populates a mutable draft snapshot via refresh_pending_window_snapshots.

begin;

do $$
declare
  v_game_id uuid;
  v_window_id uuid;
begin
  select id into v_game_id from games where game_number = 27;
  if v_game_id is null then
    raise exception 'Game 27 not found';
  end if;

  select id into v_window_id
  from selection_windows
  where game_id = v_game_id and window_number = 2;

  if v_window_id is null then
    insert into selection_windows (
      game_id,
      window_number,
      status,
      eligible_sat_date,
      eligible_sun_date,
      earliest_kickoff_at,
      deadline_at,
      start_at,
      end_at
    ) values (
      v_game_id,
      2,
      'pending',
      '2026-08-22',
      '2026-08-23',
      timestamptz '2026-08-22T11:30:00+00',
      timestamptz '2026-08-22T10:30:00+00',
      timestamptz '2026-08-20T11:30:00+00',
      timestamptz '2026-08-24T11:30:00+00'
    )
    returning id into v_window_id;
  end if;

  perform public.refresh_pending_window_snapshots(v_window_id);
end $$;

commit;

select sw.window_number, sw.status, sw.eligible_sat_date, sw.eligible_sun_date,
       sw.earliest_kickoff_at, sw.deadline_at,
       (select count(*) from selection_window_eligible_fixtures swef where swef.window_id = sw.id) as snapshot_count
from selection_windows sw
join games g on g.id = sw.game_id
where g.game_number = 27 and sw.window_number = 2;
