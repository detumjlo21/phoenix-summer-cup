-- PHOENIX V24 - HALL OF CHAMPIONS

create table if not exists public.champion_seasons(
  id bigint generated always as identity primary key,
  season_label text not null,
  tournament_name text not null,
  season_date date not null,
  banner_url text,
  team_number integer not null,
  team_name text not null,
  team_logo_url text,
  total_points integer not null default 0,
  total_kills integer not null default 0,
  booyahs integer not null default 0,
  mvp_player_id uuid,
  mvp_name text,
  mvp_kills integer not null default 0,
  mvp_character_url text,
  created_at timestamptz not null default now(),
  unique(season_label,tournament_name)
);

alter table public.champion_seasons enable row level security;

drop policy if exists "public read champion seasons" on public.champion_seasons;
create policy "public read champion seasons"
on public.champion_seasons
for select to anon,authenticated
using(true);

drop policy if exists "admins manage champion seasons" on public.champion_seasons;
create policy "admins manage champion seasons"
on public.champion_seasons
for all to authenticated
using(public.is_phoenix_admin())
with check(public.is_phoenix_admin());

grant select on public.champion_seasons to anon,authenticated;
grant insert,update,delete on public.champion_seasons to authenticated;

insert into storage.buckets(id,name,public)
values('champion-banners','champion-banners',true)
on conflict(id) do update set public=true;

drop policy if exists "public read champion banners" on storage.objects;
create policy "public read champion banners"
on storage.objects
for select to public
using(bucket_id='champion-banners');

drop policy if exists "admins upload champion banners" on storage.objects;
create policy "admins upload champion banners"
on storage.objects
for insert to authenticated
with check(
  bucket_id='champion-banners'
  and public.is_phoenix_admin()
);

drop policy if exists "admins update champion banners" on storage.objects;
create policy "admins update champion banners"
on storage.objects
for update to authenticated
using(
  bucket_id='champion-banners'
  and public.is_phoenix_admin()
);

drop policy if exists "admins delete champion banners" on storage.objects;
create policy "admins delete champion banners"
on storage.objects
for delete to authenticated
using(
  bucket_id='champion-banners'
  and public.is_phoenix_admin()
);

create or replace function public.archive_current_season(
  p_season_label text,
  p_tournament_name text,
  p_season_date date,
  p_banner_url text default null
)
returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare
  champion_team integer;
  champion_name text;
  champion_logo text;
  champion_points integer;
  champion_kills integer;
  champion_booyahs integer;
  mvp_record record;
  mvp_character text;
  new_id bigint;
begin
  if not public.is_phoenix_admin() then
    raise exception 'not_admin';
  end if;

  select
    r.team_number,
    t.name,
    t.logo_url,
    sum(r.total_points)::integer,
    sum(r.kills)::integer,
    count(*) filter(where r.placement=1)::integer
  into
    champion_team,
    champion_name,
    champion_logo,
    champion_points,
    champion_kills,
    champion_booyahs
  from public.match_results r
  left join public.team_names t on t.team_number=r.team_number
  group by r.team_number,t.name,t.logo_url
  having count(distinct r.match_number)>=4
  order by
    sum(r.total_points) desc,
    count(*) filter(where r.placement=1) desc,
    sum(r.kills) desc,
    r.team_number
  limit 1;

  if champion_team is null then
    raise exception 'Chưa có đủ kết quả 4 trận để xác định nhà vô địch.';
  end if;

  select * into mvp_record
  from public.get_public_mvp()
  limit 1;

  select character_image_url into mvp_character
  from public.mvp_settings
  where id=1;

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
    p_season_label,
    p_tournament_name,
    p_season_date,
    p_banner_url,
    champion_team,
    coalesce(champion_name,'Đội '||champion_team),
    champion_logo,
    champion_points,
    champion_kills,
    champion_booyahs,
    mvp_record.player_id,
    mvp_record.game_name,
    coalesce(mvp_record.total_kills,0),
    mvp_character
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.archive_current_season(text,text,date,text) to authenticated;

drop function if exists public.get_top_champion_teams();

create function public.get_top_champion_teams()
returns table(
  team_number integer,
  team_name text,
  logo_url text,
  championships bigint
)
language sql
security definer
set search_path=public
as $$
select
  team_number,
  max(team_name) as team_name,
  max(team_logo_url) as logo_url,
  count(*)::bigint as championships
from public.champion_seasons
group by team_number
order by count(*) desc,max(team_name)
limit 10;
$$;

grant execute on function public.get_top_champion_teams() to anon,authenticated;

notify pgrst,'reload schema';
