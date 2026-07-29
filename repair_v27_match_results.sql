-- PHOENIX V27 - KẾT QUẢ TỪNG TRẬN
-- Chạy sau V22. Không xóa dữ liệu cũ.

drop function if exists public.get_public_match_results_detailed();

create function public.get_public_match_results_detailed()
returns table(
  match_number integer,
  team_number integer,
  team_name text,
  logo_url text,
  placement integer,
  kills integer,
  total_points integer
)
language sql
security definer
set search_path=public
as $$
select
  r.match_number,
  r.team_number,
  coalesce(t.name,'Đội '||r.team_number) as team_name,
  t.logo_url,
  r.placement,
  r.kills,
  r.total_points
from public.match_results r
join public.match_publication publication
  on publication.match_number=r.match_number
left join public.team_names t
  on t.team_number=r.team_number
where publication.is_published=true
order by r.match_number,r.placement;
$$;

grant execute on function public.get_public_match_results_detailed()
to anon,authenticated;

notify pgrst,'reload schema';
