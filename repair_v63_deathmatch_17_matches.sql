-- PHOENIX V63 - TỬ CHIẾN: 12 đội / 17 trận / thắng-thua / Top 8 / chung kết
-- Chạy 1 lần trong Supabase SQL Editor.
-- Luồng: 6 Vòng 1 -> 3 Vé vớt -> 1 Quyết đấu (1 đặc cách) -> 4 TK -> 2 BK -> 1 CK BO5.

alter table public.deathmatch_matches
  drop constraint if exists deathmatch_matches_stage_check;
alter table public.deathmatch_matches
  add constraint deathmatch_matches_stage_check
  check(stage in ('group','playoff','round1','repechage','decider','quarterfinal','semifinal','final'));

alter table public.deathmatch_matches
  add column if not exists bye_team integer references public.team_names(team_number) on delete set null;

alter table public.deathmatch_matches
  drop constraint if exists deathmatch_matches_group_code_check;
alter table public.deathmatch_matches
  add constraint deathmatch_matches_group_code_check
  check(group_code in ('A','B','C','X','Q','S','F','R1','RV','D') or group_code is null);

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
  delete from public.deathmatch_player_kills where true;
  delete from public.deathmatch_matches where true;
  insert into public.deathmatch_matches(stage,group_code,match_order,round_name,team_a,team_b,best_of,status)
  values
    ('round1','R1',1,'Trận 1 • Vòng 1',null,null,3,'pending'),
    ('round1','R1',2,'Trận 2 • Vòng 1',null,null,3,'pending'),
    ('round1','R1',3,'Trận 3 • Vòng 1',null,null,3,'pending'),
    ('round1','R1',4,'Trận 4 • Vòng 1',null,null,3,'pending'),
    ('round1','R1',5,'Trận 5 • Vòng 1',null,null,3,'pending'),
    ('round1','R1',6,'Trận 6 • Vòng 1',null,null,3,'pending'),
    ('repechage','RV',1,'Trận 7 • Vé vớt',null,null,3,'pending'),
    ('repechage','RV',2,'Trận 8 • Vé vớt',null,null,3,'pending'),
    ('repechage','RV',3,'Trận 9 • Vé vớt',null,null,3,'pending'),
    ('decider','D',1,'Trận 10 • Quyết đấu',null,null,3,'pending'),
    ('quarterfinal','Q',1,'Tứ kết 1 • Vé 1 vs Vé 8',null,null,3,'pending'),
    ('quarterfinal','Q',2,'Tứ kết 2 • Vé 4 vs Vé 5',null,null,3,'pending'),
    ('quarterfinal','Q',3,'Tứ kết 3 • Vé 2 vs Vé 7',null,null,3,'pending'),
    ('quarterfinal','Q',4,'Tứ kết 4 • Vé 3 vs Vé 6',null,null,3,'pending'),
    ('semifinal','S',1,'Bán kết 1',null,null,3,'pending'),
    ('semifinal','S',2,'Bán kết 2',null,null,3,'pending'),
    ('final','F',1,'Chung kết',null,null,5,'pending');
end;
$$;
grant execute on function public.admin_init_deathmatch_bracket() to authenticated;

-- Bốc thăm ngẫu nhiên 12 đội thành 6 cặp ở Vòng 1.
create or replace function public.admin_draw_deathmatch_round1()
returns void language plpgsql security definer set search_path=public as $$
declare arr integer[]; i integer;
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;
  if exists(select 1 from public.deathmatch_matches where stage='round1' and status<>'pending') then raise exception 'round1_already_started'; end if;
  select array_agg(team_number order by random()) into arr from generate_series(1,12) team_number;
  for i in 1..6 loop
    update public.deathmatch_matches
      set team_a=arr[(i*2)-1], team_b=arr[i*2], updated_at=now()
    where stage='round1' and match_order=i;
  end loop;
end;
$$;
grant execute on function public.admin_draw_deathmatch_round1() to authenticated;

create or replace function public.admin_refresh_deathmatch_progression()
returns void language plpgsql security definer set search_path=public as $$
declare losers integer[]; rwinners integer[]; chosen_bye integer; remaining integer[];
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;

  -- Sau Vòng 1: 6 đội thắng giữ 6 vé đầu tiên; 6 đội thua xuống Vé vớt.
  if (select count(*) from public.deathmatch_matches where stage='round1' and status='completed')=6
     and (select count(*) from public.deathmatch_matches where stage='repechage')=3
     and not exists(select 1 from public.deathmatch_matches where stage='repechage' and (team_a is not null or team_b is not null)) then
    select array_agg(x.team_number order by random()) into losers
    from (
      select case when m.winner_team=m.team_a then m.team_b else m.team_a end team_number
      from public.deathmatch_matches m where m.stage='round1' and m.status='completed'
    ) x;
    for i in 1..3 loop
      update public.deathmatch_matches set
        team_a=losers[(i*2)-1], team_b=losers[i*2], updated_at=now()
      where stage='repechage' and match_order=i;
    end loop;
  end if;

  -- Sau 3 trận Vé vớt: 1 đội được Đặc cách; 2 đội còn lại đấu Trận 10.
  if (select count(*) from public.deathmatch_matches where stage='repechage' and status='completed')=3
     and not exists(select 1 from public.deathmatch_matches where stage='decider' and (team_a is not null or team_b is not null or winner_team is not null)) then
    select array_agg(winner_team order by random()) into rwinners
    from public.deathmatch_matches where stage='repechage' and winner_team is not null;
    chosen_bye:=rwinners[1];
    remaining:=array[rwinners[2],rwinners[3]];
    update public.deathmatch_matches set
      team_a=remaining[1], team_b=remaining[2], updated_at=now()
    where stage='decider' and match_order=1;
    update public.deathmatch_matches set
      bye_team=chosen_bye,
      round_name='Trận 10 • Quyết đấu • Đặc cách: '||(select name from public.team_names where team_number=chosen_bye),
      updated_at=now()
    where stage='decider' and match_order=1;
  end if;

  -- Sau Quyết đấu: 6 đội thắng Vòng 1 + Đặc cách = Vé 1..7; thắng Trận 10 = Vé 8.
  if (select count(*) from public.deathmatch_matches where stage='decider' and status='completed')=1 then
    with seeds as (
      select row_number() over(order by match_order)::int seed, winner_team
      from public.deathmatch_matches where stage='round1' and status='completed'
    ), first_six as (
      select seed,winner_team from seeds
    ), bye as (
      select bye_team as team_number from public.deathmatch_matches where stage='decider' and match_order=1
    ), decider_winner as (
      select winner_team as team_number from public.deathmatch_matches where stage='decider' and match_order=1
    )
    update public.deathmatch_matches m set
      team_a=case m.match_order
        when 1 then (select winner_team from first_six where seed=1)
        when 2 then (select winner_team from first_six where seed=4)
        when 3 then (select winner_team from first_six where seed=2)
        when 4 then (select winner_team from first_six where seed=3)
      end,
      team_b=case m.match_order
        when 1 then (select winner_team from decider_winner)
        when 2 then (select winner_team from first_six where seed=5)
        when 3 then (select winner_team from bye)
        when 4 then (select winner_team from first_six where seed=6)
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
    update public.deathmatch_matches set
      team_a=(select winner_team from public.deathmatch_matches where stage='semifinal' and match_order=1),
      team_b=(select winner_team from public.deathmatch_matches where stage='semifinal' and match_order=2),
      updated_at=now()
    where stage='final' and match_order=1;
  end if;
end;
$$;
grant execute on function public.admin_refresh_deathmatch_progression() to authenticated;

create or replace function public.admin_set_deathmatch_winner(p_match_id bigint,p_winner_team integer,p_status text default 'completed')
returns void language plpgsql security definer set search_path=public as $$
declare m public.deathmatch_matches%rowtype; bye_team integer;
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;
  select * into m from public.deathmatch_matches where id=p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if p_status not in ('pending','live','completed') then raise exception 'invalid_status'; end if;
  if p_status='completed' and p_winner_team is null then raise exception 'winner_required'; end if;
  if p_winner_team is not null and p_winner_team not in (m.team_a,m.team_b) then raise exception 'winner_must_be_in_match'; end if;
  -- Trận Quyết đấu đang giữ winner_team = đội đặc cách trước khi hoàn tất; khi hoàn tất, ghi đè bằng đội thắng.
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
  if a is null or b is null then raise exception 'match_teams_not_ready'; end if;
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
