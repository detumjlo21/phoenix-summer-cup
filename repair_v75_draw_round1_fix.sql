-- PHOENIX V75 - Sửa bốc thăm Vòng 1: báo lỗi rõ ràng thay vì "thành công giả"
-- Chạy 1 lần trong Supabase SQL Editor (sau repair_v63).
-- Gồm: (1) sửa lỗi 'DELETE requires a WHERE clause' ở hàm khởi tạo bracket, (2) sửa hàm bốc thăm.

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

create or replace function public.admin_draw_deathmatch_round1()
returns void language plpgsql security definer set search_path=public as $$
declare arr integer[]; i integer; n integer; t integer;
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;
  select count(*) into n from public.deathmatch_matches where stage='round1';
  if n<>6 then raise exception 'bracket_not_initialized'; end if;
  if exists(select 1 from public.deathmatch_matches where stage='round1' and status<>'pending') then
    raise exception 'round1_already_started';
  end if;
  select count(*) into t from public.team_names where team_number between 1 and 12;
  if t<12 then raise exception 'Thiếu đội: team_names mới có % / 12 đội', t; end if;
  select array_agg(x.team_number order by random()) into arr
  from (select team_number from public.team_names where team_number between 1 and 12) x;
  for i in 1..6 loop
    update public.deathmatch_matches
       set team_a=arr[(i*2)-1], team_b=arr[i*2], updated_at=now()
     where stage='round1' and match_order=i;
  end loop;
end;
$$;
grant execute on function public.admin_draw_deathmatch_round1() to authenticated;
