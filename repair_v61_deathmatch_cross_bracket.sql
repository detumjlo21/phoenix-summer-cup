-- PHOENIX V61 - TỬ CHIẾN: 12 đội / 27 trận / cọ xát chéo / Top 8 / chung kết
-- Chạy 1 lần trong Supabase SQL Editor.

alter table public.deathmatch_matches
  drop constraint if exists deathmatch_matches_group_code_check;
alter table public.deathmatch_matches
  add constraint deathmatch_matches_group_code_check
  check(group_code in ('A','B','C','X','Q','S','F') or group_code is null);

create table if not exists public.deathmatch_player_kills(
  match_id bigint not null references public.deathmatch_matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  kills integer not null default 0 check(kills>=0),
  updated_at timestamptz not null default now(),
  primary key(match_id,player_id)
);

alter table public.deathmatch_player_kills enable row level security;
drop policy if exists "public read deathmatch player kills" on public.deathmatch_player_kills;
create policy "public read deathmatch player kills" on public.deathmatch_player_kills
for select to anon,authenticated using(true);
drop policy if exists "admins manage deathmatch player kills" on public.deathmatch_player_kills;
create policy "admins manage deathmatch player kills" on public.deathmatch_player_kills
for all to authenticated using(public.is_phoenix_admin()) with check(public.is_phoenix_admin());
grant select on public.deathmatch_player_kills to anon,authenticated;
grant insert,update,delete on public.deathmatch_player_kills to authenticated;

create or replace function public.admin_init_deathmatch_bracket()
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;
  delete from public.deathmatch_player_kills;
  delete from public.deathmatch_matches;

  insert into public.deathmatch_matches(stage,group_code,match_order,round_name,team_a,team_b,best_of,status)
  values
    ('group','A',1,'Trận 1',1,2,3,'pending'),('group','A',2,'Trận 2',3,4,3,'pending'),
    ('group','A',3,'Trận 3 - Chung kết nhánh thắng',null,null,3,'pending'),('group','A',4,'Trận 4 - Tranh vé Ba',null,null,3,'pending'),
    ('group','B',1,'Trận 1',5,6,3,'pending'),('group','B',2,'Trận 2',7,8,3,'pending'),
    ('group','B',3,'Trận 3 - Chung kết nhánh thắng',null,null,3,'pending'),('group','B',4,'Trận 4 - Tranh vé Ba',null,null,3,'pending'),
    ('group','C',1,'Trận 1',9,10,3,'pending'),('group','C',2,'Trận 2',11,12,3,'pending'),
    ('group','C',3,'Trận 3 - Chung kết nhánh thắng',null,null,3,'pending'),('group','C',4,'Trận 4 - Tranh vé Ba',null,null,3,'pending'),
    ('playoff','X',1,'Nhánh 1 - Nhất A vs Nhì B',null,null,3,'pending'),
    ('playoff','X',2,'Nhánh 2 - Nhất B vs Nhì C',null,null,3,'pending'),
    ('playoff','X',3,'Nhánh 3 - Nhất C vs Nhì A',null,null,3,'pending'),
    ('playoff','X',4,'Nhánh 4 - Ba A vs Ba B',null,null,3,'pending'),
    ('playoff','X',5,'Nhánh 1 - Nhì A vs Ba C',null,null,3,'pending'),
    ('playoff','X',6,'Nhánh 2 - Nhì B vs Ba A',null,null,3,'pending'),
    ('playoff','X',7,'Nhánh 3 - Nhì C vs Ba B',null,null,3,'pending'),
    ('playoff','X',8,'Nhánh 4 - Nhất A vs Ba C',null,null,3,'pending'),
    ('quarterfinal','Q',1,'Tứ kết 1',null,null,3,'pending'),('quarterfinal','Q',2,'Tứ kết 2',null,null,3,'pending'),
    ('quarterfinal','Q',3,'Tứ kết 3',null,null,3,'pending'),('quarterfinal','Q',4,'Tứ kết 4',null,null,3,'pending'),
    ('semifinal','S',1,'Bán kết 1',null,null,3,'pending'),('semifinal','S',2,'Bán kết 2',null,null,3,'pending'),
    ('final','F',1,'Chung kết',null,null,5,'pending');
end;
$$;
grant execute on function public.admin_init_deathmatch_bracket() to authenticated;

create or replace function public.admin_refresh_deathmatch_progression()
returns void language plpgsql security definer set search_path=public as $$
declare
  g text; base integer; a1 integer; a2 integer; a3 integer; a4 integer;
  r1 integer; r2 integer; r3 integer;
  wa integer; wb integer; wc integer; ra integer; rb integer; rc integer; ba integer; bb integer; bc integer;
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;

  -- Ghép trận 3 và 4 của từng bảng khi trận 1 + 2 đã chốt.
  foreach g in array array['A','B','C'] loop
    if (select count(*) from public.deathmatch_matches where stage='group' and group_code=g and match_order in (1,2) and status='completed')=2 then
      update public.deathmatch_matches m set
        team_a=(select winner_team from public.deathmatch_matches where stage='group' and group_code=g and match_order=1),
        team_b=(select winner_team from public.deathmatch_matches where stage='group' and group_code=g and match_order=2),
        updated_at=now()
      where m.stage='group' and m.group_code=g and m.match_order=3;

      update public.deathmatch_matches m set
        team_a=case when (select winner_team from public.deathmatch_matches where stage='group' and group_code=g and match_order=1)=(select team_a from public.deathmatch_matches where stage='group' and group_code=g and match_order=1) then (select team_b from public.deathmatch_matches where stage='group' and group_code=g and match_order=1) else (select team_a from public.deathmatch_matches where stage='group' and group_code=g and match_order=1) end,
        team_b=case when (select winner_team from public.deathmatch_matches where stage='group' and group_code=g and match_order=2)=(select team_a from public.deathmatch_matches where stage='group' and group_code=g and match_order=2) then (select team_b from public.deathmatch_matches where stage='group' and group_code=g and match_order=2) else (select team_a from public.deathmatch_matches where stage='group' and group_code=g and match_order=2) end,
        updated_at=now()
      where m.stage='group' and m.group_code=g and m.match_order=4;
    end if;
  end loop;

  -- Chỉ khi cả 3 bảng đã hoàn tất mới ghép 8 trận cọ xát chéo.
  if (select count(*) from public.deathmatch_matches where stage='group' and status='completed')=12 then
    -- Lấy hạng 1/2/3 từ mỗi bảng.
    foreach g in array array['A','B','C'] loop
      base:=case g when 'A' then 1 when 'B' then 5 else 9 end;
      a1:=(select winner_team from public.deathmatch_matches where stage='group' and group_code=g and match_order=3);
      a2:=(select case when winner_team=team_a then team_b else team_a end from public.deathmatch_matches where stage='group' and group_code=g and match_order=3);
      a3:=(select winner_team from public.deathmatch_matches where stage='group' and group_code=g and match_order=4);
      if g='A' then wa:=a1;ra:=a2;ba:=a3; elsif g='B' then wb:=a1;rb:=a2;bb:=a3; else wc:=a1;rc:=a2;bc:=a3; end if;
    end loop;

    update public.deathmatch_matches set team_a=wa,team_b=rb,updated_at=now() where stage='playoff' and group_code='X' and match_order=1;
    update public.deathmatch_matches set team_a=wb,team_b=rc,updated_at=now() where stage='playoff' and group_code='X' and match_order=2;
    update public.deathmatch_matches set team_a=wc,team_b=ra,updated_at=now() where stage='playoff' and group_code='X' and match_order=3;
    update public.deathmatch_matches set team_a=ba,team_b=bb,updated_at=now() where stage='playoff' and group_code='X' and match_order=4;
    update public.deathmatch_matches set team_a=ra,team_b=bc,updated_at=now() where stage='playoff' and group_code='X' and match_order=5;
    update public.deathmatch_matches set team_a=rb,team_b=ba,updated_at=now() where stage='playoff' and group_code='X' and match_order=6;
    update public.deathmatch_matches set team_a=rc,team_b=bb,updated_at=now() where stage='playoff' and group_code='X' and match_order=7;
    update public.deathmatch_matches set team_a=wa,team_b=bc,updated_at=now() where stage='playoff' and group_code='X' and match_order=8;
  end if;

  -- Tứ kết: thắng các cặp 1+5, 2+6, 3+7, 4+8.
  if (select count(*) from public.deathmatch_matches where stage='playoff' and match_order in (1,2,3,4,5,6,7,8) and status='completed')=8 then
    update public.deathmatch_matches set team_a=(select winner_team from public.deathmatch_matches where stage='playoff' and match_order=1),team_b=(select winner_team from public.deathmatch_matches where stage='playoff' and match_order=5),updated_at=now() where stage='quarterfinal' and match_order=1;
    update public.deathmatch_matches set team_a=(select winner_team from public.deathmatch_matches where stage='playoff' and match_order=2),team_b=(select winner_team from public.deathmatch_matches where stage='playoff' and match_order=6),updated_at=now() where stage='quarterfinal' and match_order=2;
    update public.deathmatch_matches set team_a=(select winner_team from public.deathmatch_matches where stage='playoff' and match_order=3),team_b=(select winner_team from public.deathmatch_matches where stage='playoff' and match_order=7),updated_at=now() where stage='quarterfinal' and match_order=3;
    update public.deathmatch_matches set team_a=(select winner_team from public.deathmatch_matches where stage='playoff' and match_order=4),team_b=(select winner_team from public.deathmatch_matches where stage='playoff' and match_order=8),updated_at=now() where stage='quarterfinal' and match_order=4;
  end if;

  if (select count(*) from public.deathmatch_matches where stage='quarterfinal' and status='completed')=4 then
    update public.deathmatch_matches set team_a=(select winner_team from public.deathmatch_matches where stage='quarterfinal' and match_order=1),team_b=(select winner_team from public.deathmatch_matches where stage='quarterfinal' and match_order=2),updated_at=now() where stage='semifinal' and match_order=1;
    update public.deathmatch_matches set team_a=(select winner_team from public.deathmatch_matches where stage='quarterfinal' and match_order=3),team_b=(select winner_team from public.deathmatch_matches where stage='quarterfinal' and match_order=4),updated_at=now() where stage='semifinal' and match_order=2;
  end if;

  if (select count(*) from public.deathmatch_matches where stage='semifinal' and status='completed')=2 then
    update public.deathmatch_matches set team_a=(select winner_team from public.deathmatch_matches where stage='semifinal' and match_order=1),team_b=(select winner_team from public.deathmatch_matches where stage='semifinal' and match_order=2),updated_at=now() where stage='final' and match_order=1;
  end if;
end;
$$;
grant execute on function public.admin_refresh_deathmatch_progression() to authenticated;

create or replace function public.admin_set_deathmatch_winner(p_match_id bigint,p_winner_team integer,p_status text default 'completed')
returns void language plpgsql security definer set search_path=public as $$
declare m public.deathmatch_matches%rowtype;
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;
  select * into m from public.deathmatch_matches where id=p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if p_status not in ('pending','live','completed') then raise exception 'invalid_status'; end if;
  if p_status='completed' and p_winner_team is null then raise exception 'winner_required'; end if;
  if p_winner_team is not null and p_winner_team not in (m.team_a,m.team_b) then raise exception 'winner_must_be_in_match'; end if;
  update public.deathmatch_matches set winner_team=p_winner_team,status=p_status,updated_at=now() where id=m.id;
  perform public.admin_refresh_deathmatch_progression();
end;
$$;
grant execute on function public.admin_set_deathmatch_winner(bigint,integer,text) to authenticated;

create or replace function public.admin_save_deathmatch_kills(p_match_id bigint,p_rows jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare r jsonb; pid uuid; k integer; a integer; b integer;
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;
  select team_a,team_b into a,b from public.deathmatch_matches where id=p_match_id;
  if not found then raise exception 'match_not_found'; end if;
  delete from public.deathmatch_player_kills where match_id=p_match_id;
  for r in select * from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop
    pid:=(r->>'player_id')::uuid; k:=greatest(coalesce((r->>'kills')::integer,0),0);
    if not exists(select 1 from public.players p where p.id=pid and p.team_number in (a,b)) then raise exception 'player_not_in_match'; end if;
    insert into public.deathmatch_player_kills(match_id,player_id,kills,updated_at) values(p_match_id,pid,k,now());
  end loop;
end;
$$;
grant execute on function public.admin_save_deathmatch_kills(bigint,jsonb) to authenticated;

create or replace function public.get_public_deathmatch_top3()
returns table(rank bigint,player_id uuid,game_name text,team_number integer,team_name text,total_kills bigint)
language sql security definer set search_path=public as $$
select row_number() over(order by sum(k.kills) desc,p.game_name asc) as rank,
       p.id,p.game_name,p.team_number,t.name,sum(k.kills)::bigint
from public.deathmatch_player_kills k
join public.players p on p.id=k.player_id
left join public.team_names t on t.team_number=p.team_number
group by p.id,p.game_name,p.team_number,t.name
order by sum(k.kills) desc,p.game_name asc
limit 3;
$$;
grant execute on function public.get_public_deathmatch_top3() to anon,authenticated;

notify pgrst,'reload schema';
