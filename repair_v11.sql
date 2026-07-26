-- PHOENIX SUMMER CUP V11 - TEAM LOGOS
-- Chạy toàn bộ trong Supabase SQL Editor.
-- Thêm upload logo đội từ trang Admin.

alter table public.team_names
add column if not exists logo_url text;

-- View công khai có thêm logo đội.
drop view if exists public.public_players cascade;

create view public.public_players as
select
  p.game_name,
  p.team_number,
  t.name as team_name,
  t.logo_url,
  p.created_at
from public.players p
join public.team_names t
  on t.team_number=p.team_number;

grant select on public.public_players to anon,authenticated;

-- Hàm tra cứu lại đội của thành viên trả thêm logo.
drop function if exists public.get_player_registration(text);

create or replace function public.get_player_registration(
  p_registration_code text
)
returns table(
  game_name text,
  team_number integer,
  team_name text,
  logo_url text,
  registration_code text
)
language sql
security definer
set search_path=public
as $$
  select
    p.game_name,
    p.team_number,
    t.name as team_name,
    t.logo_url,
    p.registration_code
  from public.players p
  join public.team_names t
    on t.team_number=p.team_number
  where p.registration_code=trim(p_registration_code)
  limit 1;
$$;

revoke all on function public.get_player_registration(text) from public;
grant execute on function public.get_player_registration(text) to anon,authenticated;

-- Tạo bucket công khai nếu chưa có.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'team-logos',
  'team-logos',
  true,
  2097152,
  array['image/png','image/jpeg','image/webp']
)
on conflict(id) do update set
  public=true,
  file_size_limit=2097152,
  allowed_mime_types=array['image/png','image/jpeg','image/webp'];

-- Chỉ Admin được upload/update/delete logo.
drop policy if exists "admins upload team logos" on storage.objects;
create policy "admins upload team logos"
on storage.objects for insert to authenticated
with check(
  bucket_id='team-logos'
  and exists(
    select 1 from public.admins a
    where a.user_id=auth.uid()
  )
);

drop policy if exists "admins update team logos" on storage.objects;
create policy "admins update team logos"
on storage.objects for update to authenticated
using(
  bucket_id='team-logos'
  and exists(
    select 1 from public.admins a
    where a.user_id=auth.uid()
  )
)
with check(
  bucket_id='team-logos'
  and exists(
    select 1 from public.admins a
    where a.user_id=auth.uid()
  )
);

drop policy if exists "admins delete team logos" on storage.objects;
create policy "admins delete team logos"
on storage.objects for delete to authenticated
using(
  bucket_id='team-logos'
  and exists(
    select 1 from public.admins a
    where a.user_id=auth.uid()
  )
);

notify pgrst,'reload schema';
