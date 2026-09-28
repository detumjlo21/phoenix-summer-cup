-- PHOENIX SUMMER CUP V56
-- Nội dung chuyển khoản = TÊN FACEBOOK KHÔNG DẤU. Người chơi chỉ cần bấm xác nhận đã chuyển khoản.
-- Chạy file repair_v49_payment_approval.sql của V56, hoặc chạy file này sau đó nếu cần đồng bộ riêng phần payment.

create or replace function public.normalize_payment_facebook_name(p_text text)
returns text language sql immutable set search_path=public as $$
  select upper(regexp_replace(translate(lower(trim(coalesce(p_text,''))),
    'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiioooooooooooooooooouuuuuuuuuuuuyyyyyd'), '\s+', ' ', 'g'));
$$;

create or replace function public.confirm_registration_payment(p_request_code text)
returns table(request_code text,status text) language plpgsql security definer set search_path=public as $$
begin
  update public.registration_requests rr
  set status='pending_review', payment_confirmed_at=now()
  where rr.request_code=upper(trim(p_request_code)) and rr.status='pending_payment';
  if not found then raise exception 'request_not_found_or_already_confirmed'; end if;
  return query select upper(trim(p_request_code)),'pending_review'::text;
end; $$;

revoke all on function public.confirm_registration_payment(text) from public;
grant execute on function public.confirm_registration_payment(text) to anon,authenticated;
notify pgrst,'reload schema';
