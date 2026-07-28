-- PHOENIX V25 - CHỌN THỦ CÔNG ĐỘI VÔ ĐỊCH VÀ MVP
-- Chạy sau V24. Không xóa dữ liệu cũ.

create or replace function public.archive_selected_season(
  p_season_label text,
  p_tournament_name text,
  p_season_date date,
  p_team_number integer,
  p_mvp_player_id uuid,
  p_banner_url text default null
)
returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare
  selected_team record;
  selected_mvp record;
  selected_mvp_image text;
  new_id bigint;
begin
  if not public.is_phoenix_admin() then
    raise exception 'not_admin';
  end if;

  if nullif(trim(p_season_label),'') is null then
    raise exception 'Tên mùa không được để trống.';
  end if;

  if nullif(trim(p_tournament_name),'') is null then
    raise exception 'Tên giải không được để trống.';
  end if;

  select team_number,name,logo_url
  into selected_team
  from public.team_names
  where team_number=p_team_number;

  if selected_team.team_number is null then
    raise exception 'Không tìm thấy đội được chọn.';
  end if;

  select id,game_name,team_number
  into selected_mvp
  from public.players
  where id=p_mvp_player_id;

  if selected_mvp.id is null then
    raise exception 'Không tìm thấy MVP được chọn.';
  end if;

  -- Ưu tiên ảnh nhân vật riêng của tuyển thủ.
  if to_regclass('public.champion_character_images') is not null then
    select image_url
    into selected_mvp_image
    from public.champion_character_images
    where player_id=p_mvp_player_id;
  end if;

  -- Nếu chưa có ảnh riêng thì lấy ảnh MVP chung.
  if selected_mvp_image is null and to_regclass('public.mvp_settings') is not null then
    select character_image_url
    into selected_mvp_image
    from public.mvp_settings
    where id=1;
  end if;

  insert into public.champion_seasons(
    season_label,
    tournament_name,
    season_date,
    banner_url,
    team_number,
    team_name,
    team_logo_url,
    total_points,
    total_kills,
    booyahs,
    mvp_player_id,
    mvp_name,
    mvp_kills,
    mvp_character_url
  )
  values(
    trim(p_season_label),
    trim(p_tournament_name),
    p_season_date,
    p_banner_url,
    selected_team.team_number,
    coalesce(selected_team.name,'Đội '||selected_team.team_number),
    selected_team.logo_url,
    0,
    0,
    0,
    selected_mvp.id,
    selected_mvp.game_name,
    0,
    selected_mvp_image
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.archive_selected_season(
  text,text,date,integer,uuid,text
) to authenticated;

notify pgrst,'reload schema';
