-- PHOENIX V73.3 - MUA 1: ZEUS LA DOI TRUONG
-- Chay 1 lan sau repair_v73_2_members_names_only.sql.

update public.champion_seasons
set team_members=jsonb_build_array(
  jsonb_build_object('name','PHX 丶 Zenus 禄','is_captain',true, 'is_mvp',false),
  jsonb_build_object('name','PHX 丶 Just 禄','is_captain',false,'is_mvp',false),
  jsonb_build_object('name','PHX 丶 Oric 禄','is_captain',false,'is_mvp',false),
  jsonb_build_object('name','PHX 丶 TjnThai 禄','is_captain',false,'is_mvp',true)
)
where season_label='Mùa 1';

notify pgrst,'reload schema';
