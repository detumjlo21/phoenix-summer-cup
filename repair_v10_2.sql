-- PHOENIX SUMMER CUP V10.2
-- Sửa việc thành viên vẫn thấy đội cũ sau khi Admin chuyển đội.
-- Chạy toàn bộ trong Supabase SQL Editor. Không xóa dữ liệu.

create or replace function public.get_player_registration(
  p_registration_code text
)
returns table(
  game_name text,
  team_number integer,
  team_name text,
  registration_code text
)
language sql
security definer
set search_path=public
as $$
  select
    p.game_name,
    p.team_number,
    t.name as team_name,
    p.registration_code
  from public.players p
  join public.team_names t
    on t.team_number=p.team_number
  where p.registration_code=trim(p_registration_code)
  limit 1;
$$;

revoke all on function public.get_player_registration(text) from public;
grant execute on function public.get_player_registration(text) to anon,authenticated;

notify pgrst,'reload schema';
