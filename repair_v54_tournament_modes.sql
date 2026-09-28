-- PHOENIX SUMMER CUP V54
-- Thêm lựa chọn chế độ giải: Sinh tồn / Tử chiến.
-- Chạy một lần trong Supabase SQL Editor.

alter table public.tournament_settings
  add column if not exists game_mode text;

update public.tournament_settings
set game_mode='survival'
where game_mode is null or game_mode not in ('survival','deathmatch');

comment on column public.tournament_settings.game_mode is
  'survival = Sinh tồn, deathmatch = Tử chiến';

select id, game_mode from public.tournament_settings where id=1;
