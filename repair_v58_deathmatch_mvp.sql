-- PHOENIX V58 — TỬ CHIẾN: MVP + KẾT QUẢ TỪNG TRẬN
create table if not exists public.deathmatch_match_mvp(
  match_id bigint primary key references public.deathmatch_matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  kills integer not null default 0 check(kills>=0),
  updated_at timestamptz not null default now()
);

alter table public.deathmatch_match_mvp enable row level security;
drop policy if exists "public read deathmatch mvp" on public.deathmatch_match_mvp;
create policy "public read deathmatch mvp" on public.deathmatch_match_mvp for select to anon,authenticated using(true);
drop policy if exists "admins manage deathmatch mvp" on public.deathmatch_match_mvp;
create policy "admins manage deathmatch mvp" on public.deathmatch_match_mvp for all to authenticated using(public.is_phoenix_admin()) with check(public.is_phoenix_admin());
grant select on public.deathmatch_match_mvp to anon,authenticated;
grant insert,update,delete on public.deathmatch_match_mvp to authenticated;

create or replace function public.admin_save_deathmatch_mvp(
  p_match_id bigint,
  p_player_id uuid,
  p_kills integer default 0
)
returns void language plpgsql security definer set search_path=public as $$
declare v_a integer; v_b integer; v_player_team integer;
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;
  if p_player_id is null then
    delete from public.deathmatch_match_mvp where match_id=p_match_id;
    return;
  end if;
  select team_a,team_b into v_a,v_b from public.deathmatch_matches where id=p_match_id;
  if not found then raise exception 'match_not_found'; end if;
  select team_number into v_player_team from public.players where id=p_player_id;
  if v_player_team is null or v_player_team not in (v_a,v_b) then raise exception 'mvp_player_not_in_match'; end if;
  insert into public.deathmatch_match_mvp(match_id,player_id,kills,updated_at)
  values(p_match_id,p_player_id,greatest(coalesce(p_kills,0),0),now())
  on conflict(match_id) do update set player_id=excluded.player_id,kills=excluded.kills,updated_at=now();
end; $$;
grant execute on function public.admin_save_deathmatch_mvp(bigint,uuid,integer) to authenticated;

drop function if exists public.get_public_deathmatch_mvps();
create function public.get_public_deathmatch_mvps()
returns table(
  match_id bigint,
  player_id uuid,
  game_name text,
  team_number integer,
  team_name text,
  logo_url text,
  kills integer
)
language sql security definer set search_path=public as $$
select m.id,p.id,p.game_name,p.team_number,t.name,t.logo_url,mv.kills
from public.deathmatch_match_mvp mv
join public.deathmatch_matches m on m.id=mv.match_id
join public.players p on p.id=mv.player_id
left join public.team_names t on t.team_number=p.team_number
where m.stage='group'
order by m.group_code,m.match_order;
$$;
grant execute on function public.get_public_deathmatch_mvps() to anon,authenticated;

notify pgrst,'reload schema';
