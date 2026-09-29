-- PHOENIX CUP: cấu hình ẩn/hiện và thứ tự các khu vực trang đăng ký
create table if not exists public.registration_page_layout (
  id integer primary key check (id = 1),
  layout jsonb not null default '{"items":[{"id":"announcement","label":"Thông báo Ban tổ chức","visible":true},{"id":"join","label":"Khung đăng ký & thanh toán","visible":true},{"id":"teams","label":"Danh sách đội","visible":true},{"id":"schedule","label":"Lịch thi đấu","visible":true},{"id":"results","label":"Kết quả giải đấu","visible":true},{"id":"leaderboard","label":"Bảng xếp hạng","visible":true}]}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.registration_page_layout(id) values (1) on conflict (id) do nothing;
alter table public.registration_page_layout enable row level security;
drop policy if exists "public read registration page layout" on public.registration_page_layout;
create policy "public read registration page layout" on public.registration_page_layout for select to anon, authenticated using (true);
drop policy if exists "admins manage registration page layout" on public.registration_page_layout;
create policy "admins manage registration page layout" on public.registration_page_layout for all to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));
grant select on public.registration_page_layout to anon, authenticated;
grant insert, update, delete on public.registration_page_layout to authenticated;
