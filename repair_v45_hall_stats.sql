-- PHOENIX V45 - HALL OF CHAMPIONS: LUU DUNG THONG KE DOI + MVP
-- Chay 1 lan trong Supabase SQL Editor sau cac ban V24/V25.

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
  selected_points integer := 0;
  selected_kills integer := 0;
  selected_booyahs integer := 0;
  selected_mvp_kills integer := 0;
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

  -- Snapshot thong ke cua doi tu 4 tran da luu.
  select
    coalesce(sum(r.total_points),0)::integer,
    coalesce(sum(r.kills),0)::integer,
    count(*) filter(where r.placement=1)::integer
  into selected_points,selected_kills,selected_booyahs
  from public.match_results r
  where r.team_number=p_team_number;

  -- Snapshot kill cua dung MVP duoc admin chon.
  if to_regclass('public.player_match_results') is not null then
    select coalesce(sum(r.kills),0)::integer
    into selected_mvp_kills
    from public.player_match_results r
    where r.player_id=p_mvp_player_id;
  end if;

  -- Uu tien anh nhan vat rieng cua tuyen thu.
  if to_regclass('public.champion_character_images') is not null then
    select image_url
    into selected_mvp_image
    from public.champion_character_images
    where player_id=p_mvp_player_id;
  end if;

  -- Neu chua co anh rieng thi lay anh MVP chung.
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
    selected_points,
    selected_kills,
    selected_booyahs,
    selected_mvp.id,
    selected_mvp.game_name,
    selected_mvp_kills,
    selected_mvp_image
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.archive_selected_season(
  text,text,date,integer,uuid,text
) to authenticated;

-- Sua ban ghi Hall cu dang bi 0 bang ket qua hien tai.
-- Chi cap nhat cac dong co ca 3 thong ke doi = 0 de tranh ghi de snapshot da dung.
update public.champion_seasons cs
set
  total_points = stats.total_points,
  total_kills = stats.total_kills,
  booyahs = stats.booyahs
from (
  select
    team_number,
    coalesce(sum(total_points),0)::integer as total_points,
    coalesce(sum(kills),0)::integer as total_kills,
    count(*) filter(where placement=1)::integer as booyahs
  from public.match_results
  group by team_number
) stats
where cs.team_number=stats.team_number
  and coalesce(cs.total_points,0)=0
  and coalesce(cs.total_kills,0)=0
  and coalesce(cs.booyahs,0)=0;

-- Sua kill MVP cho ban ghi cu dang = 0.
update public.champion_seasons cs
set mvp_kills = stats.mvp_kills
from (
  select player_id,coalesce(sum(kills),0)::integer as mvp_kills
  from public.player_match_results
  group by player_id
) stats
where cs.mvp_player_id=stats.player_id
  and coalesce(cs.mvp_kills,0)=0;

notify pgrst,'reload schema';
