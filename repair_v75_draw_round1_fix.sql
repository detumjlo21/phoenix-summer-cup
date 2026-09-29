-- PHOENIX V75 - Sửa bốc thăm Vòng 1: báo lỗi rõ ràng thay vì "thành công giả"
-- Chạy 1 lần trong Supabase SQL Editor (sau repair_v63).
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
