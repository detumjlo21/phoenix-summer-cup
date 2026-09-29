-- PHOENIX CUP 2026 V71
-- 1) Admin chọn chế độ đăng ký: 'payment' (chuyển khoản + xác nhận) hoặc 'direct' (đăng ký thẳng, không thu phí).
-- 2) Random đội công bằng: chọn ngẫu nhiên theo SỐ SLOT TRỐNG của từng đội.
-- Chạy 1 lần trong Supabase SQL Editor (chạy lại nhiều lần vẫn an toàn).

alter table public.tournament_payment_settings
  add column if not exists registration_mode text not null default 'payment';

alter table public.tournament_payment_settings
  drop constraint if exists tournament_payment_settings_registration_mode_check;
alter table public.tournament_payment_settings
  add constraint tournament_payment_settings_registration_mode_check
  check (registration_mode in ('payment','direct'));

-- ---------------------------------------------------------------
-- Tạo đơn đăng ký (theo chế độ)
--   payment: status = pending_payment, bắt buộc đã cấu hình phí
--   direct : status = pending_review, phí = 0, không cần chuyển khoản
-- ---------------------------------------------------------------
create or replace function public.create_registration_request(
  p_game_name text,
  p_facebook_name text
)
returns table(request_code text, amount bigint, content text, status text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_code text;
  v_amount bigint;
  v_content text;
  v_pending integer;
  v_players integer;
  v_mode text;
  v_status text;
begin
  perform pg_advisory_xact_lock(20260949);

  if not coalesce((select ts.registration_open from public.tournament_settings ts where ts.id=1),true) then
    raise exception 'registration_closed_by_admin';
  end if;

  if (select ts.registration_deadline from public.tournament_settings ts where ts.id=1) is not null
     and now() >= (select ts.registration_deadline from public.tournament_settings ts where ts.id=1) then
    raise exception 'registration_deadline_passed';
  end if;

  if char_length(trim(p_game_name))<2 or char_length(trim(p_game_name))>40 then
    raise exception 'invalid_game_name';
  end if;
  if char_length(trim(p_facebook_name))<2 or char_length(trim(p_facebook_name))>80 then
    raise exception 'invalid_facebook_name';
  end if;

  v_content := public.normalize_payment_facebook_name(p_facebook_name);
  if char_length(v_content)<2 then
    raise exception 'invalid_payment_content';
  end if;

  if exists(select 1 from public.players p where lower(p.game_name)=lower(trim(p_game_name))) then
    raise exception 'duplicate_game_name';
  end if;
  if exists(select 1 from public.players p where lower(p.facebook_name)=lower(trim(p_facebook_name))) then
    raise exception 'duplicate_facebook_name';
  end if;
  if exists(select 1 from public.registration_requests r
            where r.status in ('pending_payment','pending_review')
              and lower(r.game_name)=lower(trim(p_game_name))) then
    raise exception 'duplicate_pending_game_name';
  end if;
  if exists(select 1 from public.registration_requests r
            where r.status in ('pending_payment','pending_review')
              and lower(r.facebook_name)=lower(trim(p_facebook_name))) then
    raise exception 'duplicate_pending_facebook_name';
  end if;

  select s.registration_mode, s.amount into v_mode, v_amount
  from public.tournament_payment_settings s where s.id=1;
  v_mode := coalesce(v_mode,'payment');

  if v_mode='direct' then
    v_amount := 0;
    v_status := 'pending_review';
  else
    if coalesce(v_amount,0)<=0 then
      raise exception 'payment_amount_not_configured';
    end if;
    v_status := 'pending_payment';
  end if;

  select count(*) into v_players from public.players;
  select count(*) into v_pending from public.registration_requests rr
  where rr.status in ('pending_payment','pending_review');
  if v_players+v_pending>=48 then
    raise exception 'tournament_full_pending';
  end if;

  v_code := upper('PSC26-'||substr(md5(clock_timestamp()::text||random()::text||p_game_name||p_facebook_name),1,8));

  insert into public.registration_requests(
    request_code,game_name,facebook_name,payment_amount,payment_reference,status,payment_confirmed_at
  ) values(
    v_code,trim(p_game_name),trim(p_facebook_name),v_amount,v_content,v_status,
    case when v_mode='direct' then now() else null end
  );

  return query select v_code,v_amount,v_content,v_status;
end;
$$;

revoke all on function public.create_registration_request(text,text) from public;
grant execute on function public.create_registration_request(text,text) to anon,authenticated;

-- ---------------------------------------------------------------
-- Duyệt đơn + random đội CÔNG BẰNG
--
-- Cách cũ: luôn chọn đội ÍT NGƯỜI NHẤT  -> 12 người đầu chắc chắn mỗi đội 1 người.
-- Cách mới: mỗi đội có "trọng số" = số slot còn trống (4 - số người hiện có),
--           rồi bốc ngẫu nhiên theo trọng số. Tương đương bốc ngẫu nhiên 1 slot
--           trống trong toàn bộ 48 slot -> 2 người đầu vẫn có thể chung đội
--           (xác suất 3/47), đội đã đầy tự động không thể bị chọn.
-- Bốc theo trọng số bằng khoá mũ: order by -ln(U)/weight (nhỏ nhất thắng).
-- ---------------------------------------------------------------
create or replace function public.admin_approve_registration(p_request_id uuid)
returns table(request_code text,team_number integer,team_name text,registration_code text)
language plpgsql
security definer
set search_path=public
as $$
declare
  r public.registration_requests%rowtype;
  v_team integer;
  v_code text;
  v_next integer;
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;
  perform pg_advisory_xact_lock(20260949);

  select * into r from public.registration_requests
  where id=p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if r.status<>'pending_review' then raise exception 'request_not_pending_review'; end if;

  if exists(select 1 from public.players p where lower(p.game_name)=lower(r.game_name)) then
    raise exception 'duplicate_game_name';
  end if;
  if exists(select 1 from public.players p where lower(p.facebook_name)=lower(r.facebook_name)) then
    raise exception 'duplicate_facebook_name';
  end if;

  select t.team_number into v_team
  from public.team_names t
  left join public.players p on p.team_number=t.team_number
  where t.team_number between 1 and 12
  group by t.team_number
  having count(p.id)<4
  order by -ln(1-random())/(4-count(p.id))
  limit 1;
  if v_team is null then raise exception 'tournament_full'; end if;

  select coalesce(max(
    case when p.registration_code ~ '^PSC2026-[0-9]+$'
      then substring(p.registration_code from '[0-9]+$')::integer
    end
  ),0)+1 into v_next from public.players p;
  v_code='PSC2026-'||lpad(v_next::text,3,'0');

  insert into public.players(game_name,facebook_name,uid,facebook_url,team_number,registration_code)
  values(r.game_name,r.facebook_name,null,null,v_team,v_code);

  update public.registration_requests
  set status='approved',team_number=v_team,registration_code=v_code,
      reviewed_at=now(),reviewed_by=auth.uid()
  where id=r.id;

  return query
  select r.request_code,v_team,t.name,v_code
  from public.team_names t where t.team_number=v_team;
end;
$$;

revoke all on function public.admin_approve_registration(uuid) from public;
grant execute on function public.admin_approve_registration(uuid) to authenticated;

notify pgrst,'reload schema';
