-- PHOENIX V73.2 - THANH VIEN DOI VO DICH: CHI LUU TEN (KHONG LUU KILL)
-- Chay 1 lan sau repair_v73_champion_members.sql.
-- 1) Ham snapshot thanh vien chi luu ten / doi truong / MVP (khong con kill)
--    -> cac mua sau (Mua 2...) se lay danh sach doi hien tai khi bam "Luu mua giai".
-- 2) Ghi tay 4 thanh vien Mua 1.

create or replace function public.build_champion_team_members(
  p_team_number integer,
  p_mvp_player_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(jsonb_agg(m order by (m->>'sort')::int, m->>'name'),'[]'::jsonb)
  from (
    select jsonb_build_object(
      'player_id',p.id,
      'name',p.game_name,
      'is_captain',coalesce(tn.captain_player_id=p.id,false),
      'is_mvp',(p.id=p_mvp_player_id),
      'sort',case when p.id=p_mvp_player_id then 0
                  when tn.captain_player_id=p.id then 1 else 2 end
    ) as m
    from public.players p
    left join public.team_names tn on tn.team_number=p.team_number
    where p.team_number=p_team_number
  ) t;
$$;

-- Mua 1: 4 thanh vien do BTC cung cap
update public.champion_seasons
set team_members=jsonb_build_array(
  jsonb_build_object('name','PHX 丶 Zeus 禄','is_captain',false,'is_mvp',false),
  jsonb_build_object('name','PHX 丶 Just 禄','is_captain',false,'is_mvp',false),
  jsonb_build_object('name','PHX 丶 Oric 禄','is_captain',false,'is_mvp',false),
  jsonb_build_object('name','PHX 丶 TjnThai 禄','is_captain',false,'is_mvp',true)
)
where season_label='Mùa 1';

notify pgrst,'reload schema';
