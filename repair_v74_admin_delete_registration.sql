-- V74: Admin xóa đơn đăng ký (kể cả đơn người chơi chưa bấm xác nhận chuyển khoản)
-- Chạy file này MỘT LẦN trong Supabase → SQL Editor.
--
-- Cho phép xóa đơn ở các trạng thái:
--   pending_payment : người chơi chưa xác nhận chuyển khoản
--   pending_review  : đã xác nhận, đang chờ duyệt
--   rejected        : đơn đã bị từ chối (dọn danh sách)
-- KHÔNG xóa đơn 'approved' vì người chơi đã nằm trong bảng players
-- (muốn gỡ người đó thì dùng nút "Xóa" ở danh sách thành viên).

create or replace function public.admin_delete_registration(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_status text;
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;

  select status into v_status
  from public.registration_requests
  where id=p_request_id
  for update;

  if not found then raise exception 'request_not_found'; end if;
  if v_status='approved' then raise exception 'request_already_approved'; end if;

  delete from public.registration_requests where id=p_request_id;
end;
$$;

revoke all on function public.admin_delete_registration(uuid) from public;
grant execute on function public.admin_delete_registration(uuid) to authenticated;

notify pgrst,'reload schema';
