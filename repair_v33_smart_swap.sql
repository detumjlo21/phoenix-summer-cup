-- PHOENIX V33 - SMART SWAP
-- Chạy sau các SQL hiện tại. Không xóa dữ liệu.

create or replace function public.admin_move_player_safe(
  p_player_id uuid,
  p_target_team integer
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  current_team integer;
  target_count integer;
begin
  if not public.is_phoenix_admin() then
    raise exception 'not_admin';
  end if;

  if p_target_team not between 1 and 12 then
    raise exception 'Đội đích không hợp lệ.';
  end if;

  select team_number
  into current_team
  from public.players
  where id=p_player_id
  for update;

  if current_team is null then
    raise exception 'Không tìm thấy tuyển thủ.';
  end if;

  if current_team=p_target_team then
    return;
  end if;

  select count(*)
  into target_count
  from public.players
  where team_number=p_target_team;

  if target_count>=4 then
    raise exception 'Đội đích đã đủ 4 người. Hãy đổi chỗ với một tuyển thủ.';
  end if;

  update public.players
  set team_number=p_target_team
  where id=p_player_id;
end;
$$;

grant execute on function public.admin_move_player_safe(uuid,integer)
to authenticated;


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

  if p_player_a=p_player_b then
    return;
  end if;

  -- Khóa hai dòng theo thứ tự ID để tránh deadlock.
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

  -- Dùng giá trị tạm 0 để tránh mọi unique constraint tiềm ẩn.
  update public.players
  set team_number=0
  where id=p_player_a;

  update public.players
  set team_number=team_a
  where id=p_player_b;

  update public.players
  set team_number=team_b
  where id=p_player_a;
end;
$$;

grant execute on function public.admin_swap_players(uuid,uuid)
to authenticated;

notify pgrst,'reload schema';
