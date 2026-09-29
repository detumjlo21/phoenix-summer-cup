-- PHOENIX CUP 2026 V70 - SECURITY HARDENING (SAFE / IDEMPOTENT)
-- Chạy file này trong Supabase SQL Editor.
-- File có thể chạy nhiều lần và không lỗi nếu các function legacy không tồn tại.

-- =========================================================
-- 0. REMOVE LEGACY DIRECT REGISTRATION FUNCTIONS SAFELY
-- =========================================================
-- Quy trình hiện tại dùng create_registration_request -> payment -> admin approve.
-- Các RPC register_player_random_team(...) cũ không còn được frontend sử dụng.
-- Một số database đã không còn function 3 tham số, vì vậy KHÔNG được REVOKE
-- trực tiếp bằng tên signature; PostgreSQL sẽ báo 42883 nếu function không tồn tại.

do $$
begin
  if to_regprocedure('public.register_player_random_team(text,text)') is not null then
    execute 'revoke all on function public.register_player_random_team(text,text) from public';
    execute 'drop function public.register_player_random_team(text,text)';
  end if;

  if to_regprocedure('public.register_player_random_team(text,text,text)') is not null then
    execute 'revoke all on function public.register_player_random_team(text,text,text) from public';
    execute 'drop function public.register_player_random_team(text,text,text)';
  end if;
end
$$;

-- =========================================================
-- 1. PRIVATE PLAYER MATCH RESULTS
-- =========================================================
-- Public không cần đọc trực tiếp từng dòng kết quả nội bộ.
alter table public.player_match_results enable row level security;
revoke select on public.player_match_results from anon;
revoke select on public.player_match_results from authenticated;

-- Admin vẫn cần quyền thao tác. RLS hiện hữu của project tiếp tục quyết định
-- ai thực sự được SELECT/INSERT/UPDATE/DELETE.
grant select, insert, update, delete on public.player_match_results to authenticated;

-- =========================================================
-- 2. PRIVATE DEATHMATCH PLAYER KILLS
-- =========================================================
alter table public.deathmatch_player_kills enable row level security;
revoke select on public.deathmatch_player_kills from anon;
revoke select on public.deathmatch_player_kills from authenticated;

grant select, insert, update, delete on public.deathmatch_player_kills to authenticated;

-- =========================================================
-- 3. PUBLIC RPC: DEATHMATCH MATCH KILL COUNTS
-- =========================================================
-- Chỉ trả số lượng player có kill theo từng trận; không trả player_id/kills.
create or replace function public.get_public_deathmatch_match_kill_counts()
returns table(
  match_id bigint,
  player_count bigint
)
language sql
stable
security definer
set search_path=public
as $$
  select
    k.match_id,
    count(*)::bigint as player_count
  from public.deathmatch_player_kills k
  where coalesce(k.kills,0) > 0
  group by k.match_id;
$$;

revoke all on function public.get_public_deathmatch_match_kill_counts() from public;
grant execute on function public.get_public_deathmatch_match_kill_counts() to anon,authenticated;

-- =========================================================
-- 4. PUBLIC RPC: TOP 10 DEATHMATCH KILL
-- =========================================================
create or replace function public.get_public_deathmatch_top10()
returns table(
  rank bigint,
  player_id uuid,
  game_name text,
  team_number integer,
  team_name text,
  total_kills bigint
)
language sql
stable
security definer
set search_path=public
as $$
  select
    row_number() over(order by sum(k.kills) desc, p.game_name asc) as rank,
    p.id as player_id,
    p.game_name,
    p.team_number,
    t.name as team_name,
    sum(k.kills)::bigint as total_kills
  from public.deathmatch_player_kills k
  join public.players p on p.id=k.player_id
  left join public.team_names t on t.team_number=p.team_number
  where coalesce(k.kills,0) > 0
  group by p.id,p.game_name,p.team_number,t.name
  having sum(k.kills)>0
  order by sum(k.kills) desc,p.game_name asc
  limit 10;
$$;

revoke all on function public.get_public_deathmatch_top10() from public;
grant execute on function public.get_public_deathmatch_top10() to anon,authenticated;

notify pgrst,'reload schema';
