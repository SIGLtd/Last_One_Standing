-- Public Current Picks board: display name + team only.
-- Does not expose email, phone, payment status, or other player profile fields.
-- Security definer so guests can view submitted picks after the deadline
-- without opening players / game_entries to anonymous SELECT.

create or replace function public.public_current_window_picks(p_window_id uuid)
returns table (
  player_id uuid,
  display_name text,
  team_id text,
  locked_at timestamptz,
  updated_at timestamptz,
  admin_corrected boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.player_id,
    p.display_name,
    s.team_id,
    s.locked_at,
    s.updated_at,
    coalesce(s.admin_corrected, false) as admin_corrected
  from selections s
  join players p on p.id = s.player_id
  where s.window_id = p_window_id
    and s.team_id is not null
  order by p.display_name;
$$;

revoke all on function public.public_current_window_picks(uuid) from public;
grant execute on function public.public_current_window_picks(uuid) to anon, authenticated;
