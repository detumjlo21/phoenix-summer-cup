-- PHOENIX V37 - QUẢN LÝ VỊ TRÍ KHU VỰC TRANG CHỦ
-- Chạy toàn bộ một lần trong Supabase SQL Editor.

create table if not exists public.public_page_sections(
  section_key text primary key,
  position integer not null check(position >= 1),
  is_visible boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint public_page_sections_key_check check(
    section_key in (
      'announcement',
      'schedule',
      'registration',
      'teams',
      'match_results',
      'leaderboard',
      'mvp',
      'champion',
      'hall'
    )
  )
);

insert into public.public_page_sections(section_key,position,is_visible)
values
  ('announcement',1,true),
  ('schedule',2,true),
  ('registration',3,true),
  ('teams',4,true),
  ('match_results',5,true),
  ('leaderboard',6,true),
  ('mvp',7,true),
  ('champion',8,true),
  ('hall',9,true)
on conflict(section_key) do nothing;

alter table public.public_page_sections enable row level security;

drop policy if exists "public read page layout"
on public.public_page_sections;

create policy "public read page layout"
on public.public_page_sections
for select
to anon,authenticated
using(true);

drop policy if exists "admins manage page layout"
on public.public_page_sections;

create policy "admins manage page layout"
on public.public_page_sections
for all
to authenticated
using(public.is_phoenix_admin())
with check(public.is_phoenix_admin());

grant select on public.public_page_sections to anon,authenticated;
grant insert,update,delete on public.public_page_sections to authenticated;

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