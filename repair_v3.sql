-- PHOENIX SUMMER CUP V3 - SỬA DATABASE
-- Chạy toàn bộ một lần trong Supabase SQL Editor.
-- Giữ nguyên tài khoản Admin và dữ liệu người đăng ký hiện có.

create extension if not exists pgcrypto;

create table if not exists public.team_names (
  team_number integer primary key check (team_number between 1 and 14),
  name text not null,
  updated_at timestamptz not null default now()
);

insert into public.team_names(team_number,name)
select n,'Đội '||n from generate_series(1,14)n
on conflict(team_number) do nothing;

alter table public.players add column if not exists team_number integer;
alter table public.players add column if not exists registration_code text;

-- Gán đội cho dữ liệu cũ nếu còn thiếu.
do $$
declare r record; i integer:=0;
begin
  for r in select id from public.players where team_number is null order by created_at,id loop
    i:=i+1;
    update public.players set team_number=((i-1)%10)+1 where id=r.id;
  end loop;
end $$;

-- Tạo mã đăng ký cho dữ liệu cũ.
do $$
declare r record; i integer:=0;
begin
  for r in select id from public.players order by created_at,id loop
    i:=i+1;
    update public.players
    set registration_code=coalesce(registration_code,'PSC2026-'||lpad(i::text,3,'0'))
    where id=r.id;
  end loop;
end $$;

alter table public.players alter column team_number set not null;
alter table public.players alter column registration_code set not null;

create unique index if not exists players_registration_code_unique on public.players(registration_code);
create index if not exists players_team_number_idx on public.players(team_number);

alter table public.players drop constraint if exists players_team_number_fkey;
alter table public.players
add constraint players_team_number_fkey
foreign key(team_number) references public.team_names(team_number);

alter table public.team_names enable row level security;

drop policy if exists "public read team names" on public.team_names;
create policy "public read team names"
on public.team_names for select to anon,authenticated using(true);

drop policy if exists "admins rename teams" on public.team_names;
create policy "admins rename teams"
on public.team_names for update to authenticated
using(exists(select 1 from public.admins a where a.user_id=auth.uid()))
with check(exists(select 1 from public.admins a where a.user_id=auth.uid()));

grant select on public.team_names to anon,authenticated;
grant update on public.team_names to authenticated;

-- View công khai chỉ có tên game và đội, không có UID/Facebook.
drop view if exists public.public_players cascade;
create view public.public_players as
select p.game_name,p.team_number,t.name as team_name,p.created_at
from public.players p
join public.team_names t on t.team_number=p.team_number;

grant select on public.public_players to anon,authenticated;

-- Đảm bảo Admin đọc và quản lý được players.
grant select,insert,update,delete on public.players to authenticated;

drop policy if exists "admins manage players" on public.players;
create policy "admins manage players"
on public.players for all to authenticated
using(exists(select 1 from public.admins a where a.user_id=auth.uid()))
with check(exists(select 1 from public.admins a where a.user_id=auth.uid()));

-- Hàm đăng ký và random đội.
-- 10 đội đầu được dùng cho 40 người đầu để phù hợp quy mô thực tế 30-40 người.
-- Khi vượt 40 người, hệ thống mở thêm đội 11-14.
create or replace function public.register_player_random_team(
  p_game_name text,
  p_uid text,
  p_facebook_url text
)
returns table(team_number integer,team_name text,registration_code text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_total integer;
  v_team integer;
  v_code text;
  v_max_team integer;
begin
  perform pg_advisory_xact_lock(20260730);

  if now()>=timestamptz '2026-07-30 23:59:59+07' then
    raise exception 'registration_closed';
  end if;

  select count(*) into v_total from public.players;
  if v_total>=55 then raise exception 'tournament_full'; end if;

  if exists(select 1 from public.players where lower(game_name)=lower(trim(p_game_name))) then
    raise exception 'duplicate_game_name';
  end if;
  if exists(select 1 from public.players where uid=trim(p_uid)) then
    raise exception 'duplicate_uid';
  end if;
  if exists(select 1 from public.players where lower(facebook_url)=lower(trim(p_facebook_url))) then
    raise exception 'duplicate_facebook';
  end if;

  v_max_team:=case when v_total<40 then 10 else 14 end;

  with counts as(
    select t.team_number,count(p.id)::integer member_count
    from public.team_names t
    left join public.players p on p.team_number=t.team_number
    where t.team_number<=v_max_team
    group by t.team_number
    having count(p.id)<4
  ),minimum as(
    select min(member_count) min_count from counts
  )
  select c.team_number into v_team
  from counts c,minimum m
  where c.member_count=m.min_count
  order by random()
  limit 1;

  if v_team is null then raise exception 'tournament_full'; end if;

  v_code:='PSC2026-'||lpad((v_total+1)::text,3,'0');

  insert into public.players(game_name,uid,facebook_url,team_number,registration_code)
  values(trim(p_game_name),trim(p_uid),trim(p_facebook_url),v_team,v_code);

  return query
  select v_team,t.name,v_code
  from public.team_names t where t.team_number=v_team;
end;
$$;

revoke all on function public.register_player_random_team(text,text,text) from public;
grant execute on function public.register_player_random_team(text,text,text) to anon,authenticated;

notify pgrst,'reload schema';
