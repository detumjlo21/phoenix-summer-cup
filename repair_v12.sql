-- PHOENIX SUMMER CUP V12 FINAL
-- Chạy toàn bộ một lần trong Supabase SQL Editor.

create table if not exists public.tournament_settings(
  id integer primary key default 1 check(id=1),
  registration_open boolean not null default true,
  announcement text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.tournament_settings(id,registration_open,announcement)
values(1,true,'')
on conflict(id) do nothing;

create table if not exists public.match_schedule(
  match_number integer primary key check(match_number between 1 and 4),
  map_name text,
  match_date date,
  match_time time,
  is_current boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.match_schedule(match_number)
select n from generate_series(1,4)n
on conflict(match_number) do nothing;

create table if not exists public.match_results(
  match_number integer not null references public.match_schedule(match_number) on delete cascade,
  team_number integer not null references public.team_names(team_number) on delete cascade,
  placement integer not null check(placement between 1 and 12),
  kills integer not null default 0 check(kills>=0),
  placement_points integer not null,
  kill_points integer not null,
  total_points integer not null,
  updated_at timestamptz not null default now(),
  primary key(match_number,team_number),
  unique(match_number,placement)
);

alter table public.tournament_settings enable row level security;
alter table public.match_schedule enable row level security;
alter table public.match_results enable row level security;

drop policy if exists "public read tournament settings" on public.tournament_settings;
create policy "public read tournament settings"
on public.tournament_settings for select to anon,authenticated using(true);

drop policy if exists "admins manage tournament settings" on public.tournament_settings;
create policy "admins manage tournament settings"
on public.tournament_settings for all to authenticated
using(public.is_phoenix_admin())
with check(public.is_phoenix_admin());

drop policy if exists "public read schedule" on public.match_schedule;
create policy "public read schedule"
on public.match_schedule for select to anon,authenticated using(true);

drop policy if exists "admins manage schedule" on public.match_schedule;
create policy "admins manage schedule"
on public.match_schedule for all to authenticated
using(public.is_phoenix_admin())
with check(public.is_phoenix_admin());

drop policy if exists "public read match results" on public.match_results;
create policy "public read match results"
on public.match_results for select to anon,authenticated using(true);

drop policy if exists "admins manage match results" on public.match_results;
create policy "admins manage match results"
on public.match_results for all to authenticated
using(public.is_phoenix_admin())
with check(public.is_phoenix_admin());

grant select on public.tournament_settings,public.match_schedule,public.match_results to anon,authenticated;
grant insert,update,delete on public.tournament_settings,public.match_schedule,public.match_results to authenticated;

drop function if exists public.register_player_random_team(text,text);

create function public.register_player_random_team(
  p_game_name text,
  p_facebook_name text
)
returns table(team_number integer,team_name text,logo_url text,registration_code text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_total integer;
  v_team integer;
  v_code text;
  v_next_number integer;
begin
  perform pg_advisory_xact_lock(20260730);

  if not coalesce((select registration_open from public.tournament_settings where id=1),true) then
    raise exception 'registration_closed_by_admin';
  end if;

  if now()>=timestamptz '2026-07-30 23:59:59+07' then
    raise exception 'registration_closed';
  end if;

  select count(*) into v_total from public.players;
  if v_total>=48 then raise exception 'tournament_full'; end if;

  if char_length(trim(p_game_name))<2 then raise exception 'invalid_game_name'; end if;
  if char_length(trim(p_facebook_name))<2 then raise exception 'invalid_facebook_name'; end if;

  if exists(select 1 from public.players p where lower(p.game_name)=lower(trim(p_game_name))) then
    raise exception 'duplicate_game_name';
  end if;

  if exists(select 1 from public.players p where lower(p.facebook_name)=lower(trim(p_facebook_name))) then
    raise exception 'duplicate_facebook_name';
  end if;

  with counts as(
    select t.team_number,count(p.id)::integer member_count
    from public.team_names t
    left join public.players p on p.team_number=t.team_number
    where t.team_number between 1 and 12
    group by t.team_number
    having count(p.id)<4
  ),
  minimum as(select min(member_count) min_count from counts)
  select c.team_number into v_team
  from counts c,minimum m
  where c.member_count=m.min_count
  order by random()
  limit 1;

  if v_team is null then raise exception 'tournament_full'; end if;

  select coalesce(max(
    case
      when p.registration_code ~ '^PSC2026-[0-9]+$'
      then substring(p.registration_code from '[0-9]+$')::integer
      else null
    end
  ),0)+1
  into v_next_number
  from public.players p;

  v_code='PSC2026-'||lpad(v_next_number::text,3,'0');

  insert into public.players(game_name,facebook_name,uid,facebook_url,team_number,registration_code)
  values(trim(p_game_name),trim(p_facebook_name),null,null,v_team,v_code);

  return query
  select v_team,t.name,t.logo_url,v_code
  from public.team_names t
  where t.team_number=v_team;
end;
$$;

revoke all on function public.register_player_random_team(text,text) from public;
grant execute on function public.register_player_random_team(text,text) to anon,authenticated;

create or replace function public.admin_save_schedule(
  p_match_number integer,
  p_map_name text,
  p_match_date date,
  p_match_time time,
  p_is_current boolean
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;
  if p_match_number<1 or p_match_number>4 then raise exception 'invalid_match'; end if;

  if p_is_current then
    update public.match_schedule set is_current=false;
  end if;

  insert into public.match_schedule(match_number,map_name,match_date,match_time,is_current,updated_at)
  values(p_match_number,nullif(trim(p_map_name),''),p_match_date,p_match_time,p_is_current,now())
  on conflict(match_number) do update set
    map_name=excluded.map_name,
    match_date=excluded.match_date,
    match_time=excluded.match_time,
    is_current=excluded.is_current,
    updated_at=now();
end;
$$;

revoke all on function public.admin_save_schedule(integer,text,date,time,boolean) from public;
grant execute on function public.admin_save_schedule(integer,text,date,time,boolean) to authenticated;

create or replace function public.admin_save_match_results(
  p_match_number integer,
  p_results jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  item jsonb;
  v_team integer;
  v_placement integer;
  v_kills integer;
  v_placement_points integer;
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;
  if p_match_number<1 or p_match_number>4 then raise exception 'invalid_match'; end if;
  if jsonb_array_length(p_results)<>12 then raise exception 'need_12_teams'; end if;

  delete from public.match_results where match_number=p_match_number;

  for item in select * from jsonb_array_elements(p_results)
  loop
    v_team=(item->>'team_number')::integer;
    v_placement=(item->>'placement')::integer;
    v_kills=greatest((item->>'kills')::integer,0);

    v_placement_points=case v_placement
      when 1 then 20
      when 2 then 17
      when 3 then 15
      when 4 then 13
      when 5 then 12
      when 6 then 10
      when 7 then 8
      when 8 then 6
      when 9 then 4
      when 10 then 2
      when 11 then 1
      when 12 then 0
      else null
    end;

    if v_placement_points is null then raise exception 'invalid_placement'; end if;

    insert into public.match_results(
      match_number,team_number,placement,kills,
      placement_points,kill_points,total_points,updated_at
    )
    values(
      p_match_number,v_team,v_placement,v_kills,
      v_placement_points,v_kills*2,v_placement_points+v_kills*2,now()
    );
  end loop;
end;
$$;

revoke all on function public.admin_save_match_results(integer,jsonb) from public;
grant execute on function public.admin_save_match_results(integer,jsonb) to authenticated;

create or replace function public.admin_clear_match_results(p_match_number integer)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;
  delete from public.match_results where match_number=p_match_number;
end;
$$;

revoke all on function public.admin_clear_match_results(integer) from public;
grant execute on function public.admin_clear_match_results(integer) to authenticated;

drop function if exists public.get_public_leaderboard();

create function public.get_public_leaderboard()
returns table(
  current_rank bigint,
  team_number integer,
  team_name text,
  logo_url text,
  matches_played bigint,
  total_kills bigint,
  booyahs bigint,
  total_points bigint,
  previous_rank bigint,
  rank_change bigint
)
language sql
security definer
set search_path=public
as $$
with latest_match as(
  select coalesce(max(match_number),0) as n
  from public.match_results
),
current_totals as(
  select
    t.team_number,
    t.name team_name,
    t.logo_url,
    count(r.match_number) matches_played,
    coalesce(sum(r.kills),0) total_kills,
    count(*) filter(where r.placement=1) booyahs,
    coalesce(sum(r.total_points),0) total_points
  from public.team_names t
  left join public.match_results r on r.team_number=t.team_number
  where t.team_number between 1 and 12
  group by t.team_number,t.name,t.logo_url
),
current_ranked as(
  select *,
    row_number() over(
      order by total_points desc,booyahs desc,total_kills desc,team_number
    ) current_rank
  from current_totals
),
previous_totals as(
  select
    t.team_number,
    coalesce(sum(r.total_points),0) total_points,
    count(*) filter(where r.placement=1) booyahs,
    coalesce(sum(r.kills),0) total_kills
  from public.team_names t
  cross join latest_match lm
  left join public.match_results r
    on r.team_number=t.team_number
    and r.match_number<lm.n
  where t.team_number between 1 and 12
  group by t.team_number
),
previous_ranked as(
  select *,
    row_number() over(
      order by total_points desc,booyahs desc,total_kills desc,team_number
    ) previous_rank
  from previous_totals
)
select
  c.current_rank,
  c.team_number,
  c.team_name,
  c.logo_url,
  c.matches_played,
  c.total_kills,
  c.booyahs,
  c.total_points,
  case when lm.n<=1 then c.current_rank else p.previous_rank end,
  case when lm.n<=1 then 0 else p.previous_rank-c.current_rank end
from current_ranked c
join previous_ranked p using(team_number)
cross join latest_match lm
order by c.current_rank;
$$;

revoke all on function public.get_public_leaderboard() from public;
grant execute on function public.get_public_leaderboard() to anon,authenticated;

notify pgrst,'reload schema';
