-- PHOENIX V68 - BXH TOP 10 KILL TỬ CHIẾN
-- Không xóa dữ liệu Kill. Chỉ tạo RPC đọc tổng Kill từ deathmatch_player_kills.
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
security definer
set search_path=public
as $$
  select
    row_number() over(order by sum(k.kills) desc, p.game_name asc) as rank,
    p.id,
    p.game_name,
    p.team_number,
    t.name,
    sum(k.kills)::bigint
  from public.deathmatch_player_kills k
  join public.players p on p.id=k.player_id
  left join public.team_names t on t.team_number=p.team_number
  group by p.id,p.game_name,p.team_number,t.name
  having sum(k.kills)>0
  order by sum(k.kills) desc,p.game_name asc
  limit 10;
$$;

grant execute on function public.get_public_deathmatch_top10() to anon,authenticated;
notify pgrst,'reload schema';
