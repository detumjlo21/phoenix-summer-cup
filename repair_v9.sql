-- PHOENIX SUMMER CUP V9
-- Chạy toàn bộ file này trong Supabase SQL Editor.
-- Thêm chức năng Admin chuyển thành viên giữa các đội.

create or replace function public.admin_move_player(
  p_player_id uuid,
  p_target_team integer
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer;
begin
  if not exists(
    select 1
    from public.admins
    where user_id=auth.uid()
  ) then
    raise exception 'not_admin';
  end if;

  if not exists(
    select 1
    from public.players
    where id=p_player_id
  ) then
    raise exception 'player_not_found';
  end if;

  if not exists(
    select 1
    from public.team_names
    where team_number=p_target_team
  ) then
    raise exception 'invalid_team';
  end if;

  perform pg_advisory_xact_lock(20260731);

  select count(*) into v_count
  from public.players
  where team_number=p_target_team
    and id<>p_player_id;

  if v_count>=4 then
    raise exception 'team_full';
  end if;

  update public.players
  set team_number=p_target_team
  where id=p_player_id;
end;
$$;

revoke all on function public.admin_move_player(uuid,integer) from public;
grant execute on function public.admin_move_player(uuid,integer) to authenticated;

notify pgrst,'reload schema';
