-- PHOENIX V73 - HALL OF CHAMPIONS: LUU DANH SACH THANH VIEN DOI VO DICH
-- Chay 1 lan trong Supabase SQL Editor (sau repair_v45_hall_stats.sql).
-- 1) Them cot team_members (snapshot ten + kill + doi truong + MVP cua tung thanh vien)
-- 2) Cap nhat archive_selected_season de cac mua sau tu luu thanh vien
-- 3) Dien du lieu cho cac mua da luu (vd: Mua 1)

alter table public.champion_seasons
  add column if not exists team_members jsonb not null default '[]'::jsonb;

-- Ham dung chung: tao snapshot thanh vien cua 1 doi
create or replace function public.build_champion_team_members(
  p_team_number integer,
  p_mvp_player_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(jsonb_agg(m order by (m->>'sort')::int, m->>'name'),'[]'::jsonb)
  from (
    select jsonb_build_object(
      'player_id',p.id,
      'name',p.game_name,
      'is_captain',(tn.captain_player_id=p.id),
      'is_mvp',(p.id=p_mvp_player_id),
      'kills',coalesce((
        select sum(r.kills)::int
        from public.player_match_results r
        where r.player_id=p.id
      ),0),
      'sort',case when tn.captain_player_id=p.id then 0 else 1 end
    ) as m
    from public.players p
    left join public.team_names tn on tn.team_number=p.team_number
    where p.team_number=p_team_number
  ) t;
$$;

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

  select
    coalesce(sum(r.total_points),0)::integer,
    coalesce(sum(r.kills),0)::integer,
    count(*) filter(where r.placement=1)::integer
  into selected_points,selected_kills,selected_booyahs
  from public.match_results r
  where r.team_number=p_team_number;

  if to_regclass('public.player_match_results') is not null then
    select coalesce(sum(r.kills),0)::integer
    into selected_mvp_kills
    from public.player_match_results r
    where r.player_id=p_mvp_player_id;
  end if;

  if to_regclass('public.champion_character_images') is not null then
    select image_url
    into selected_mvp_image
    from public.champion_character_images
    where player_id=p_mvp_player_id;
  end if;

  if selected_mvp_image is null and to_regclass('public.mvp_settings') is not null then
    select character_image_url
    into selected_mvp_image
    from public.mvp_settings
    where id=1;
  end if;

  insert into public.champion_seasons(
    season_label,tournament_name,season_date,banner_url,
    team_number,team_name,team_logo_url,
    total_points,total_kills,booyahs,
    mvp_player_id,mvp_name,mvp_kills,mvp_character_url,
    team_members
  )
  values(
    trim(p_season_label),
    trim(p_tournament_name),
    p_season_date,
    p_banner_url,
    selected_team.team_number,
    coalesce(selected_team.name,'Đội '||selected_team.team_number),
    selected_team.logo_url,
    selected_points,selected_kills,selected_booyahs,
    selected_mvp.id,selected_mvp.game_name,selected_mvp_kills,selected_mvp_image,
    public.build_champion_team_members(p_team_number,p_mvp_player_id)
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.archive_selected_season(
  text,text,date,integer,uuid,text
) to authenticated;

-- Dien thanh vien cho cac mua da luu nhung chua co danh sach (vd: Mua 1)
update public.champion_seasons cs
set team_members=public.build_champion_team_members(cs.team_number,cs.mvp_player_id)
where jsonb_array_length(coalesce(cs.team_members,'[]'::jsonb))=0;

notify pgrst,'reload schema';
