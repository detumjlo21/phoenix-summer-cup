-- PHOENIX V39 - ĐỔI TÊN TUYỂN THỦ AN TOÀN
-- Chạy file này một lần trong Supabase > SQL Editor.

create or replace function public.admin_rename_player_safe(
  p_player_id uuid,
  p_game_name text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  cleaned_name text;
begin
  if not public.is_phoenix_admin() then
    raise exception 'not_admin';
  end if;

  cleaned_name := regexp_replace(trim(coalesce(p_game_name,'')), '\\s+', ' ', 'g');

  if char_length(cleaned_name) < 2 or char_length(cleaned_name) > 40 then
    raise exception 'invalid_player_name';
  end if;

  if not exists(select 1 from public.players where id=p_player_id) then
    raise exception 'player_not_found';
  end if;

  if exists(
    select 1
    from public.players
    where id<>p_player_id
      and lower(trim(game_name))=lower(cleaned_name)
  ) then
    raise exception 'duplicate_player_name';
  end if;

  update public.players
  set game_name=cleaned_name
  where id=p_player_id;
end;
$$;

grant execute on function public.admin_rename_player_safe(uuid,text)
to authenticated;

notify pgrst,'reload schema';
