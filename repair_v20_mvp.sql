-- PHOENIX V20 MVP KILL

create table if not exists public.player_match_results(
  match_number integer not null check(match_number between 1 and 4),
  player_id uuid not null references public.players(id) on delete cascade,
  kills integer not null default 0 check(kills>=0),
  updated_at timestamptz not null default now(),
  primary key(match_number,player_id)
);

create table if not exists public.mvp_settings(
  id integer primary key default 1 check(id=1),
  character_image_url text,
  updated_at timestamptz not null default now()
);

insert into public.mvp_settings(id) values(1)
on conflict(id) do nothing;

alter table public.player_match_results enable row level security;
alter table public.mvp_settings enable row level security;

drop policy if exists "public read player kills" on public.player_match_results;
create policy "public read player kills"
on public.player_match_results for select to anon,authenticated using(true);

drop policy if exists "admins manage player kills" on public.player_match_results;
create policy "admins manage player kills"
on public.player_match_results for all to authenticated
using(public.is_phoenix_admin())
with check(public.is_phoenix_admin());

drop policy if exists "public read mvp settings" on public.mvp_settings;
create policy "public read mvp settings"
on public.mvp_settings for select to anon,authenticated using(true);

drop policy if exists "admins manage mvp settings" on public.mvp_settings;
create policy "admins manage mvp settings"
on public.mvp_settings for all to authenticated
using(public.is_phoenix_admin())
with check(public.is_phoenix_admin());

grant select on public.player_match_results,public.mvp_settings to anon,authenticated;
grant insert,update,delete on public.player_match_results,public.mvp_settings to authenticated;

insert into storage.buckets(id,name,public)
values('mvp-characters','mvp-characters',true)
on conflict(id) do update set public=true;

drop policy if exists "public read mvp characters" on storage.objects;
create policy "public read mvp characters"
on storage.objects for select to public
using(bucket_id='mvp-characters');

drop policy if exists "admins upload mvp characters" on storage.objects;
create policy "admins upload mvp characters"
on storage.objects for insert to authenticated
with check(bucket_id='mvp-characters' and public.is_phoenix_admin());

drop policy if exists "admins update mvp characters" on storage.objects;
create policy "admins update mvp characters"
on storage.objects for update to authenticated
using(bucket_id='mvp-characters' and public.is_phoenix_admin());

drop policy if exists "admins delete mvp characters" on storage.objects;
create policy "admins delete mvp characters"
on storage.objects for delete to authenticated
using(bucket_id='mvp-characters' and public.is_phoenix_admin());

create or replace function public.admin_save_player_kills(
  p_match_number integer,
  p_results jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare item jsonb;
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;
  if p_match_number<1 or p_match_number>4 then raise exception 'invalid_match'; end if;

  delete from public.player_match_results where match_number=p_match_number;

  for item in select * from jsonb_array_elements(p_results)
  loop
    insert into public.player_match_results(match_number,player_id,kills,updated_at)
    values(
      p_match_number,
      (item->>'player_id')::uuid,
      greatest((item->>'kills')::integer,0),
      now()
    );
  end loop;
end;
$$;

grant execute on function public.admin_save_player_kills(integer,jsonb) to authenticated;

drop function if exists public.get_public_mvp();

create function public.get_public_mvp()
returns table(
  player_id uuid,
  game_name text,
  team_number integer,
  team_name text,
  logo_url text,
  total_kills bigint,
  matches_played bigint
)
language sql
security definer
set search_path=public
as $$
select
  p.id,
  p.game_name,
  p.team_number,
  t.name,
  t.logo_url,
  coalesce(sum(r.kills),0)::bigint,
  count(r.match_number)::bigint
from public.players p
left join public.team_names t on t.team_number=p.team_number
left join public.player_match_results r on r.player_id=p.id
group by p.id,p.game_name,p.team_number,t.name,t.logo_url
order by coalesce(sum(r.kills),0) desc,p.game_name
limit 1;
$$;

grant execute on function public.get_public_mvp() to anon,authenticated;

notify pgrst,'reload schema';
