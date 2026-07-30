-- PHOENIX V33.1 - SMART SWAP HOTFIX
-- Sửa lỗi foreign key do V33 từng dùng team_number = 0.
-- Chạy file này sau repair_v33_smart_swap.sql.
-- Không xóa dữ liệu.

create or replace function public.admin_swap_players(
  p_player_a uuid,
  p_player_b uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  team_a integer;
  team_b integer;
begin
  if not public.is_phoenix_admin() then
    raise exception 'not_admin';
  end if;

  if p_player_a is null or p_player_b is null then
    raise exception 'Thiếu tuyển thủ cần đổi.';
  end if;

  if p_player_a=p_player_b then
    return;
  end if;

  perform 1
  from public.players
  where id in(p_player_a,p_player_b)
  order by id
  for update;

  select team_number into team_a
  from public.players
  where id=p_player_a;

  select team_number into team_b
  from public.players
  where id=p_player_b;

  if team_a is null or team_b is null then
    raise exception 'Không tìm thấy một trong hai tuyển thủ.';
  end if;

  if team_a=team_b then
    raise exception 'Hai tuyển thủ đang ở cùng một đội.';
  end if;

  update public.players
  set team_number=case
    when id=p_player_a then team_b
    when id=p_player_b then team_a
    else team_number
  end
  where id in(p_player_a,p_player_b);
end;
$$;

grant execute on function public.admin_swap_players(uuid,uuid)
to authenticated;

notify pgrst,'reload schema';
