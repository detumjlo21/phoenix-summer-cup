-- PHOENIX V21 - CHAMPION HONOR

create table if not exists public.champion_character_images(
  player_id uuid primary key references public.players(id) on delete cascade,
  image_url text not null,
  updated_at timestamptz not null default now()
);

alter table public.champion_character_images enable row level security;

drop policy if exists "public read champion images" on public.champion_character_images;
create policy "public read champion images"
on public.champion_character_images
for select to anon,authenticated
using(true);

drop policy if exists "admins manage champion images" on public.champion_character_images;
create policy "admins manage champion images"
on public.champion_character_images
for all to authenticated
using(public.is_phoenix_admin())
with check(public.is_phoenix_admin());

grant select on public.champion_character_images to anon,authenticated;
grant insert,update,delete on public.champion_character_images to authenticated;

insert into storage.buckets(id,name,public)
values('champion-characters','champion-characters',true)
on conflict(id) do update set public=true;

drop policy if exists "public read champion characters" on storage.objects;
create policy "public read champion characters"
on storage.objects for select to public
using(bucket_id='champion-characters');

drop policy if exists "admins upload champion characters" on storage.objects;
create policy "admins upload champion characters"
on storage.objects for insert to authenticated
with check(
  bucket_id='champion-characters'
  and public.is_phoenix_admin()
);

drop policy if exists "admins update champion characters" on storage.objects;
create policy "admins update champion characters"
on storage.objects for update to authenticated
using(
  bucket_id='champion-characters'
  and public.is_phoenix_admin()
);

drop policy if exists "admins delete champion characters" on storage.objects;
create policy "admins delete champion characters"
on storage.objects for delete to authenticated
using(
  bucket_id='champion-characters'
  and public.is_phoenix_admin()
);

notify pgrst,'reload schema';
