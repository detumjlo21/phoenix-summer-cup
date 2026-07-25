-- PHOENIX SUMMER CUP V2
-- Chạy TOÀN BỘ file này một lần trong Supabase > SQL Editor.
-- File này nâng cấp dữ liệu cũ sang kiểu: đăng ký xong random đội ngay.

create extension if not exists pgcrypto;

-- 14 đội là đủ chứa tối đa 55 người, mỗi đội tối đa 4 người.
create table if not exists public.team_names (
  team_number integer primary key check (team_number between 1 and 14),
  name text not null,
  updated_at timestamptz not null default now()
);

insert into public.team_names(team_number,name)
select n, 'Đội ' || n
from generate_series(1,14) n
on conflict (team_number) do nothing;

alter table public.players add column if not exists team_number integer;
alter table public.players add column if not exists registration_code text;

-- Xóa bảng teams cũ vì V2 lưu đội trực tiếp trong players.
drop table if exists public.teams cascade;

-- Nếu trước đây đã có người đăng ký nhưng chưa có đội, gán lần lượt để không mất dữ liệu.
with ranked as (
  select id, row_number() over(order by created_at,id) as rn
  from public.players
  where team_number is null
)
update public.players p
set team_number = ((ranked.rn - 1) / 4) + 1
from ranked
where p.id = ranked.id;

-- Tạo mã đăng ký tương thích cho dữ liệu cũ.
do $$
declare r record; i integer := 0;
begin
  for r in select id from public.players where registration_code is null order by created_at,id loop
    i := i + 1;
    update public.players
    set registration_code='PSC2026-'||lpad(i::text,3,'0')
    where id=r.id;
  end loop;
end $$;

alter table public.players alter column team_number set not null;
alter table public.players alter column registration_code set not null;

create unique index if not exists players_registration_code_unique on public.players(registration_code);
create index if not exists players_team_number_idx on public.players(team_number);

-- View công khai: không lộ UID và Facebook.
create or replace view public.public_players
with (security_invoker=true)
as
select
  p.game_name,
  p.team_number,
  t.name as team_name,
  p.created_at
from public.players p
join public.team_names t on t.team_number=p.team_number;

grant select on public.public_players to anon, authenticated;
grant select on public.team_names to anon, authenticated;
grant update on public.team_names to authenticated;

alter table public.team_names enable row level security;

drop policy if exists "public read team names" on public.team_names;
create policy "public read team names"
on public.team_names for select to anon,authenticated
using (true);

drop policy if exists "admins rename teams" on public.team_names;
create policy "admins rename teams"
on public.team_names for update to authenticated
using (exists(select 1 from public.admins a where a.user_id=auth.uid()))
with check (exists(select 1 from public.admins a where a.user_id=auth.uid()));

-- Public không đọc trực tiếp bảng players nữa.
revoke select on public.players from anon;
grant select,insert,update,delete on public.players to authenticated;

-- Hàm đăng ký + random đội chạy trong transaction và khóa để tránh vượt 4 người/đội.
create or replace function public.register_player_random_team(
  p_game_name text,
  p_uid text,
  p_facebook_url text
)
returns table(
  team_number integer,
  team_name text,
  registration_code text
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_total integer;
  v_team integer;
  v_code text;
begin
  -- Khóa giao dịch riêng cho việc đăng ký.
  perform pg_advisory_xact_lock(20260802);

  if now() >= timestamptz '2026-08-02 23:59:00+07' then
    raise exception 'registration_closed';
  end if;

  select count(*) into v_total from public.players;
  if v_total >= 55 then
    raise exception 'tournament_full';
  end if;

  if exists(select 1 from public.players where lower(game_name)=lower(trim(p_game_name))) then
    raise exception 'duplicate_game_name';
  end if;
  if exists(select 1 from public.players where uid=trim(p_uid)) then
    raise exception 'duplicate_uid';
  end if;
  if exists(select 1 from public.players where lower(facebook_url)=lower(trim(p_facebook_url))) then
    raise exception 'duplicate_facebook';
  end if;

  -- Chỉ chọn trong các đội đang có số người thấp nhất.
  -- Nhờ vậy đội luôn cân bằng, nhưng vẫn ngẫu nhiên trong nhóm đội ít người.
  with counts as (
    select t.team_number, count(p.id)::integer as member_count
    from public.team_names t
    left join public.players p on p.team_number=t.team_number
    group by t.team_number
    having count(p.id) < 4
  ),
  minimum as (
    select min(member_count) as min_count from counts
  )
  select c.team_number into v_team
  from counts c, minimum m
  where c.member_count=m.min_count
  order by random()
  limit 1;

  if v_team is null then
    raise exception 'tournament_full';
  end if;

  v_code := 'PSC2026-' || lpad((v_total+1)::text,3,'0');

  insert into public.players(game_name,uid,facebook_url,team_number,registration_code)
  values(trim(p_game_name),trim(p_uid),trim(p_facebook_url),v_team,v_code);

  return query
  select v_team,t.name,v_code
  from public.team_names t
  where t.team_number=v_team;
end;
$$;

revoke all on function public.register_player_random_team(text,text,text) from public;
grant execute on function public.register_player_random_team(text,text,text) to anon,authenticated;

-- Admin vẫn quản lý players bằng policy cũ.
drop policy if exists "public register player" on public.players;
drop policy if exists "public read player names" on public.players;
