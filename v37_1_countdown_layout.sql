-- PHOENIX V37.1 - THÊM KHU VỰC ĐẾM NGƯỢC VÀO QUẢN LÝ BỐ CỤC
-- Chạy toàn bộ một lần trong Supabase SQL Editor.

alter table public.public_page_sections
drop constraint if exists public_page_sections_key_check;

alter table public.public_page_sections
add constraint public_page_sections_key_check check(
  section_key in (
    'announcement',
    'countdown',
    'schedule',
    'registration',
    'teams',
    'match_results',
    'leaderboard',
    'mvp',
    'champion',
    'hall'
  )
);

insert into public.public_page_sections(section_key,position,is_visible)
values('countdown',2,true)
on conflict(section_key) do update set
  is_visible=true,
  updated_at=now();

-- Đặt thứ tự mặc định:
-- Thông báo BTC → Đếm ngược → Lịch thi đấu.
update public.public_page_sections
set position=case section_key
  when 'announcement' then 1
  when 'countdown' then 2
  when 'schedule' then 3
  when 'registration' then 4
  when 'teams' then 5
  when 'match_results' then 6
  when 'leaderboard' then 7
  when 'mvp' then 8
  when 'champion' then 9
  when 'hall' then 10
  else position
end,
updated_at=now();

create or replace function public.admin_save_public_layout(
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  item jsonb;
  v_key text;
  v_position integer;
  v_visible boolean;
begin
  if not public.is_phoenix_admin() then
    raise exception 'not_admin';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid_layout';
  end if;

  for item in
    select value
    from jsonb_array_elements(p_items)
  loop
    v_key=item->>'section_key';
    v_position=(item->>'position')::integer;
    v_visible=coalesce((item->>'is_visible')::boolean,true);

    if v_key not in(
      'announcement',
      'countdown',
      'schedule',
      'registration',
      'teams',
      'match_results',
      'leaderboard',
      'mvp',
      'champion',
      'hall'
    ) then
      raise exception 'invalid_section';
    end if;

    if v_position<1 then
      raise exception 'invalid_position';
    end if;

    insert into public.public_page_sections(
      section_key,
      position,
      is_visible,
      updated_at
    )
    values(
      v_key,
      v_position,
      v_visible,
      now()
    )
    on conflict(section_key) do update set
      position=excluded.position,
      is_visible=excluded.is_visible,
      updated_at=now();
  end loop;
end;
$$;

revoke all
on function public.admin_save_public_layout(jsonb)
from public;

grant execute
on function public.admin_save_public_layout(jsonb)
to authenticated;

notify pgrst,'reload schema';