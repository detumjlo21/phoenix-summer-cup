-- PHOENIX V35 - HIỂN THỊ ĐỘI TRƯỞNG Ở TRANG ĐĂNG KÝ
-- Chạy toàn bộ file này một lần trong Supabase SQL Editor.

create or replace function public.get_public_players_v35()
returns table(
  id uuid,
  game_name text,
  team_number integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path=public
as $$
  select
    p.id,
    p.game_name,
    p.team_number,
    p.created_at
  from public.players p
  order by p.created_at,p.id;
$$;

revoke all on function public.get_public_players_v35() from public;
grant execute on function public.get_public_players_v35() to anon,authenticated;

notify pgrst,'reload schema';
