-- PHOENIX V62 - TỬ CHIẾN: 12 đội / 19 trận / cọ xát A-B-C / Top 8 / chung kết
-- Chạy 1 lần trong Supabase SQL Editor.
-- Luồng: 12 trận cọ xát chéo (mỗi đội 2 trận) -> BXH -> Top 8 -> 4 TK -> 2 BK -> 1 CK BO5.

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
    ('cross','X',1,'Trận 1 • A1 vs B1',1,5,3,'pending'),
    ('cross','X',2,'Trận 2 • A2 vs B2',2,6,3,'pending'),
    ('cross','X',3,'Trận 3 • A3 vs B3',3,7,3,'pending'),
    ('cross','X',4,'Trận 4 • A4 vs B4',4,8,3,'pending'),
    ('cross','X',5,'Trận 5 • B1 vs C1',5,9,3,'pending'),
    ('cross','X',6,'Trận 6 • B2 vs C2',6,10,3,'pending'),
    ('cross','X',7,'Trận 7 • B3 vs C3',7,11,3,'pending'),
    ('cross','X',8,'Trận 8 • B4 vs C4',8,12,3,'pending'),
    ('cross','X',9,'Trận 9 • C1 vs A1',9,1,3,'pending'),
    ('cross','X',10,'Trận 10 • C2 vs A2',10,2,3,'pending'),
    ('cross','X',11,'Trận 11 • C3 vs A3',11,3,3,'pending'),
    ('cross','X',12,'Trận 12 • C4 vs A4',12,4,3,'pending'),
    ('quarterfinal','Q',1,'Tứ kết 1 • Top 1 vs Top 8',null,null,3,'pending'),
    ('quarterfinal','Q',2,'Tứ kết 2 • Top 4 vs Top 5',null,null,3,'pending'),
    ('quarterfinal','Q',3,'Tứ kết 3 • Top 2 vs Top 7',null,null,3,'pending'),
    ('quarterfinal','Q',4,'Tứ kết 4 • Top 3 vs Top 6',null,null,3,'pending'),
    ('semifinal','S',1,'Bán kết 1',null,null,3,'pending'),
    ('semifinal','S',2,'Bán kết 2',null,null,3,'pending'),
    ('final','F',1,'Chung kết',null,null,5,'pending');
end;
$$;
grant execute on function public.admin_init_deathmatch_bracket() to authenticated;

create or replace function public.admin_refresh_deathmatch_progression()
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;

  -- Sau 12 trận cọ xát: xếp hạng theo số trận thắng, sau đó tổng Kill, rồi số đội.
  if (select count(*) from public.deathmatch_matches where stage='cross' and status='completed')=12 then
    update public.deathmatch_matches set
      team_a=null, team_b=null, winner_team=null, status='pending', updated_at=now()
    where stage in ('quarterfinal','semifinal','final');

    with team_stats as (
      select t.team_number,
             coalesce(w.wins,0) as wins,
             coalesce(k.total_kills,0) as total_kills
      from generate_series(1,12) as t(team_number)
      left join (
        select winner_team as team_number, count(*)::int as wins
        from public.deathmatch_matches
        where stage='cross' and status='completed' and winner_team is not null
        group by winner_team
      ) w on w.team_number=t.team_number
      left join (
        select p.team_number, coalesce(sum(k.kills),0)::bigint as total_kills
        from public.deathmatch_player_kills k
        join public.players p on p.id=k.player_id
        join public.deathmatch_matches m on m.id=k.match_id and m.stage='cross'
        group by p.team_number
      ) k on k.team_number=t.team_number
    ), ranked as (
      select team_number, row_number() over(order by wins desc,total_kills desc,team_number asc) as seed
      from team_stats
    )
    update public.deathmatch_matches m
    set team_a=case m.match_order
      when 1 then (select team_number from ranked where seed=1)
      when 2 then (select team_number from ranked where seed=4)
      when 3 then (select team_number from ranked where seed=2)
      when 4 then (select team_number from ranked where seed=3)
    end,
    team_b=case m.match_order
      when 1 then (select team_number from ranked where seed=8)
      when 2 then (select team_number from ranked where seed=5)
      when 3 then (select team_number from ranked where seed=7)
      when 4 then (select team_number from ranked where seed=6)
    end,
    updated_at=now()
    where m.stage='quarterfinal';
  end if;

  if (select count(*) from public.deathmatch_matches where stage='quarterfinal' and status='completed')=4 then
    update public.deathmatch_matches set
      team_a=case when match_order=1 then (select winner_team from public.deathmatch_matches where stage='quarterfinal' and match_order=1)
                  when match_order=2 then (select winner_team from public.deathmatch_matches where stage='quarterfinal' and match_order=3) end,
      team_b=case when match_order=1 then (select winner_team from public.deathmatch_matches where stage='quarterfinal' and match_order=2)
                  when match_order=2 then (select winner_team from public.deathmatch_matches where stage='quarterfinal' and match_order=4) end,
      updated_at=now()
    where stage='semifinal';
  end if;

  if (select count(*) from public.deathmatch_matches where stage='semifinal' and status='completed')=2 then
    update public.deathmatch_matches
    set team_a=(select winner_team from public.deathmatch_matches where stage='semifinal' and match_order=1),
        team_b=(select winner_team from public.deathmatch_matches where stage='semifinal' and match_order=2),
        updated_at=now()
    where stage='final' and match_order=1;
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
