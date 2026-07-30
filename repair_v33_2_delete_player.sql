-- PHOENIX V33.2 - XÓA TUYỂN THỦ AN TOÀN

create or replace function public.admin_delete_player_safe(
  p_player_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  found_player boolean;
begin
  if not public.is_phoenix_admin() then
    raise exception 'not_admin';
  end if;

  select exists(
    select 1 from public.players where id=p_player_id
  ) into found_player;

  if not found_player then
    raise exception 'Không tìm thấy tuyển thủ.';
  end if;

  delete from public.player_match_results
  where player_id=p_player_id;

  delete from public.champion_character_images
  where player_id=p_player_id;

  update public.champion_seasons
  set mvp_player_id=null
  where mvp_player_id=p_player_id;

  delete from public.players
  where id=p_player_id;
end;
$$;

grant execute on function public.admin_delete_player_safe(uuid)
to authenticated;

notify pgrst,'reload schema';
