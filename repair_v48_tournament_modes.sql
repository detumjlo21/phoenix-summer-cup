-- PHOENIX V48 — 2 chế độ giải: SINH TỒN / TỬ CHIẾN
-- Chạy 1 lần trong Supabase SQL Editor.

alter table public.tournament_settings
  add column if not exists game_mode text not null default 'survival';

alter table public.tournament_settings
  drop constraint if exists tournament_settings_game_mode_check;

alter table public.tournament_settings
  add constraint tournament_settings_game_mode_check
  check (game_mode in ('survival','deathmatch'));

update public.tournament_settings
set game_mode='survival'
where game_mode is null or game_mode not in ('survival','deathmatch');

create table if not exists public.deathmatch_matches (
  id bigint generated always as identity primary key,
  stage text not null check(stage in ('group','playoff','quarterfinal','semifinal','final')),
  group_code text check(group_code in ('A','B','C') or group_code is null),
  match_order integer not null,
  round_name text not null,
  team_a integer references public.team_names(team_number) on delete set null,
  team_b integer references public.team_names(team_number) on delete set null,
  winner_team integer references public.team_names(team_number) on delete set null,
  best_of integer not null default 3 check(best_of in (3,5)),
  status text not null default 'pending' check(status in ('pending','live','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(stage, group_code, match_order)
);

create index if not exists deathmatch_matches_stage_idx
  on public.deathmatch_matches(stage,group_code,match_order);

alter table public.deathmatch_matches enable row level security;

drop policy if exists "public read deathmatch matches" on public.deathmatch_matches;
create policy "public read deathmatch matches"
on public.deathmatch_matches for select to anon,authenticated
using(true);

drop policy if exists "admins manage deathmatch matches" on public.deathmatch_matches;
create policy "admins manage deathmatch matches"
on public.deathmatch_matches for all to authenticated
using(public.is_phoenix_admin())
with check(public.is_phoenix_admin());

grant select on public.deathmatch_matches to anon,authenticated;
grant insert,update,delete on public.deathmatch_matches to authenticated;

create or replace function public.admin_init_deathmatch_groups()
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  g text;
  base integer;
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;

  delete from public.deathmatch_matches where stage='group';

  foreach g in array array['A','B','C'] loop
    base := case g when 'A' then 1 when 'B' then 5 else 9 end;

    insert into public.deathmatch_matches(stage,group_code,match_order,round_name,team_a,team_b,best_of,status)
    values
      ('group',g,1,'Trận 1',base,base+1,3,'pending'),
      ('group',g,2,'Trận 2',base+2,base+3,3,'pending'),
      ('group',g,3,'Trận phân định Nhất/Nhì',null,null,3,'pending'),
      ('group',g,4,'Trận tranh vé Ba',null,null,3,'pending');
  end loop;
end;
$$;

grant execute on function public.admin_init_deathmatch_groups() to authenticated;

create or replace function public.admin_set_deathmatch_winner(
  p_match_id bigint,
  p_winner_team integer,
  p_status text default 'completed'
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  m public.deathmatch_matches%rowtype;
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;

  select * into m from public.deathmatch_matches where id=p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if p_status not in ('pending','live','completed') then raise exception 'invalid_status'; end if;
  if p_status='completed' and p_winner_team is null then raise exception 'winner_required'; end if;
  if p_winner_team is not null and p_winner_team not in (m.team_a,m.team_b) then raise exception 'winner_must_be_in_match'; end if;

  update public.deathmatch_matches
  set winner_team=p_winner_team,status=p_status,updated_at=now()
  where id=m.id;

  -- Sau khi 2 trận đầu của bảng có người thắng, tự ghép trận 3.
  if m.stage='group' and m.match_order in (1,2) and p_status='completed' then
    if exists(select 1 from public.deathmatch_matches x where x.stage='group' and x.group_code=m.group_code and x.match_order=1 and x.status='completed')
       and exists(select 1 from public.deathmatch_matches x where x.stage='group' and x.group_code=m.group_code and x.match_order=2 and x.status='completed') then
      update public.deathmatch_matches x
      set team_a=(select winner_team from public.deathmatch_matches where stage='group' and group_code=m.group_code and match_order=1),
          team_b=(select winner_team from public.deathmatch_matches where stage='group' and group_code=m.group_code and match_order=2),
          updated_at=now()
      where x.stage='group' and x.group_code=m.group_code and x.match_order=3;

      update public.deathmatch_matches x
      set team_a=(select team_a from public.deathmatch_matches where stage='group' and group_code=m.group_code and match_order=1),
          team_b=(select team_a from public.deathmatch_matches where stage='group' and group_code=m.group_code and match_order=2),
          updated_at=now()
      where false;

      -- Trận 4 = hai đội thua của Trận 1 và Trận 2.
      update public.deathmatch_matches x
      set team_a=case when (select winner_team from public.deathmatch_matches where stage='group' and group_code=m.group_code and match_order=1) = (select team_a from public.deathmatch_matches where stage='group' and group_code=m.group_code and match_order=1) then (select team_b from public.deathmatch_matches where stage='group' and group_code=m.group_code and match_order=1) else (select team_a from public.deathmatch_matches where stage='group' and group_code=m.group_code and match_order=1) end,
          team_b=case when (select winner_team from public.deathmatch_matches where stage='group' and group_code=m.group_code and match_order=2) = (select team_a from public.deathmatch_matches where stage='group' and group_code=m.group_code and match_order=2) then (select team_b from public.deathmatch_matches where stage='group' and group_code=m.group_code and match_order=2) else (select team_a from public.deathmatch_matches where stage='group' and group_code=m.group_code and match_order=2) end,
          updated_at=now()
      where x.stage='group' and x.group_code=m.group_code and x.match_order=4;
    end if;
  end if;
end;
$$;

grant execute on function public.admin_set_deathmatch_winner(bigint,integer,text) to authenticated;

-- Bản RPC tạo mùa mới có thêm lựa chọn chế độ.
create or replace function public.admin_start_new_season(
  p_keep_teams boolean default true,
  p_game_mode text default 'survival'
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;
  if p_game_mode not in ('survival','deathmatch') then raise exception 'invalid_game_mode'; end if;

  if to_regclass('public.tournament_backups') is not null then
    insert into public.tournament_backups(backup_data,reason)
    values(public.admin_export_tournament_backup(),'before_new_season');
  end if;

  delete from public.player_match_results;
  delete from public.match_results;
  if to_regclass('public.match_result_snapshots') is not null then
    delete from public.match_result_snapshots;
  end if;
  if to_regclass('public.deathmatch_matches') is not null then
    delete from public.deathmatch_matches;
  end if;

  if to_regclass('public.match_publication') is not null then
    update public.match_publication set is_published=false,is_locked=false,published_at=null,updated_at=now();
  end if;

  update public.match_schedule
  set map_name=null,match_date=null,match_time=null,is_current=false,updated_at=now();

  update public.tournament_settings
  set registration_open=true,announcement='',game_mode=p_game_mode,updated_at=now()
  where id=1;

  if not p_keep_teams then
    if to_regclass('public.champion_character_images') is not null then delete from public.champion_character_images; end if;
    delete from public.players;
    update public.team_names set name='Đội '||team_number,logo_url=null,updated_at=now() where team_number between 1 and 12;
  end if;
end;
$$;

grant execute on function public.admin_start_new_season(boolean,text) to authenticated;

notify pgrst,'reload schema';
