-- PHOENIX SUMMER CUP V49
-- Đăng ký cá nhân + chuyển khoản + Admin duyệt đơn.
-- Chạy sau các SQL hiện tại của website.

create table if not exists public.tournament_payment_settings(
  id integer primary key default 1 check(id=1),
  amount bigint not null default 0 check(amount>=0),
  content_prefix text not null default 'PSC',
  instructions text not null default 'Quét mã QR, chuyển đúng số tiền và nhập mã giao dịch để gửi xác nhận.',
  updated_at timestamptz not null default now()
);

insert into public.tournament_payment_settings(id)
values(1)
on conflict(id) do nothing;

create table if not exists public.registration_requests(
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique,
  game_name text not null,
  facebook_name text not null,
  payment_amount bigint not null default 0,
  payment_reference text,
  status text not null default 'pending_payment'
    check(status in ('pending_payment','pending_review','approved','rejected')),
  rejection_reason text,
  team_number integer,
  registration_code text,
  created_at timestamptz not null default now(),
  payment_confirmed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

create index if not exists registration_requests_status_idx
  on public.registration_requests(status,created_at);
create index if not exists registration_requests_game_name_idx
  on public.registration_requests(lower(game_name));
create index if not exists registration_requests_facebook_name_idx
  on public.registration_requests(lower(facebook_name));

alter table public.tournament_payment_settings enable row level security;
alter table public.registration_requests enable row level security;

drop policy if exists "public read payment settings" on public.tournament_payment_settings;
create policy "public read payment settings"
on public.tournament_payment_settings for select to anon,authenticated using(true);

drop policy if exists "admins manage payment settings" on public.tournament_payment_settings;
create policy "admins manage payment settings"
on public.tournament_payment_settings for all to authenticated
using(public.is_phoenix_admin())
with check(public.is_phoenix_admin());

drop policy if exists "admins read registration requests" on public.registration_requests;
create policy "admins read registration requests"
on public.registration_requests for select to authenticated
using(public.is_phoenix_admin());

grant select on public.tournament_payment_settings to anon,authenticated;
grant select on public.registration_requests to authenticated;
grant update on public.registration_requests to authenticated;

-- Không cho đăng ký trực tiếp bỏ qua bước thanh toán.
revoke all on function public.register_player_random_team(text,text) from public;
revoke all on function public.register_player_random_team(text,text,text) from public;

create or replace function public.create_registration_request(
  p_game_name text,
  p_facebook_name text
)
returns table(
  request_code text,
  amount bigint,
  content text,
  status text
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_code text;
  v_amount bigint;
  v_prefix text;
  v_pending integer;
  v_players integer;
begin
  perform pg_advisory_xact_lock(20260949);

  if not coalesce((select registration_open from public.tournament_settings where id=1),true) then
    raise exception 'registration_closed_by_admin';
  end if;

  if char_length(trim(p_game_name))<2 or char_length(trim(p_game_name))>40 then
    raise exception 'invalid_game_name';
  end if;
  if char_length(trim(p_facebook_name))<2 or char_length(trim(p_facebook_name))>80 then
    raise exception 'invalid_facebook_name';
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

  select amount,content_prefix into v_amount,v_prefix
  from public.tournament_payment_settings where id=1;

  if coalesce(v_amount,0)<=0 then
    raise exception 'payment_amount_not_configured';
  end if;

  select count(*) into v_players from public.players;
  select count(*) into v_pending from public.registration_requests
  where status in ('pending_payment','pending_review');

  if v_players+v_pending>=48 then
    raise exception 'tournament_full_pending';
  end if;

  v_code := upper('PSC26-'||substr(encode(gen_random_bytes(4),'hex'),1,8));

  insert into public.registration_requests(
    request_code,game_name,facebook_name,payment_amount,status
  ) values(
    v_code,trim(p_game_name),trim(p_facebook_name),v_amount,'pending_payment'
  );

  return query
  select v_code,v_amount,
         trim(coalesce(v_prefix,'PSC'))||' '||v_code,
         'pending_payment'::text;
end;
$$;

revoke all on function public.create_registration_request(text,text) from public;
grant execute on function public.create_registration_request(text,text) to anon,authenticated;

create or replace function public.confirm_registration_payment(
  p_request_code text,
  p_payment_reference text
)
returns table(request_code text,status text)
language plpgsql
security definer
set search_path=public
as $$
begin
  if char_length(trim(coalesce(p_payment_reference,'')))<2 then
    raise exception 'invalid_payment_reference';
  end if;

  update public.registration_requests
  set payment_reference=trim(p_payment_reference),
      status='pending_review',
      payment_confirmed_at=now()
  where request_code=upper(trim(p_request_code))
    and status='pending_payment';

  if not found then raise exception 'request_not_found_or_already_confirmed'; end if;

  return query
  select upper(trim(p_request_code)),'pending_review'::text;
end;
$$;

revoke all on function public.confirm_registration_payment(text,text) from public;
grant execute on function public.confirm_registration_payment(text,text) to anon,authenticated;

create or replace function public.get_registration_request_status(p_request_code text)
returns table(
  request_code text,
  game_name text,
  facebook_name text,
  amount bigint,
  payment_reference text,
  status text,
  rejection_reason text,
  team_number integer,
  registration_code text,
  created_at timestamptz
)
language sql
security definer
set search_path=public
as $$
  select r.request_code,r.game_name,r.facebook_name,r.payment_amount,
         r.payment_reference,r.status,r.rejection_reason,r.team_number,
         r.registration_code,r.created_at
  from public.registration_requests r
  where r.request_code=upper(trim(p_request_code))
  limit 1;
$$;

revoke all on function public.get_registration_request_status(text) from public;
grant execute on function public.get_registration_request_status(text) to anon,authenticated;

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
  order by count(p.id),random()
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

create or replace function public.admin_reject_registration(
  p_request_id uuid,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;
  update public.registration_requests
  set status='rejected',rejection_reason=nullif(trim(coalesce(p_reason,'')),''),
      reviewed_at=now(),reviewed_by=auth.uid()
  where id=p_request_id and status='pending_review';
  if not found then raise exception 'request_not_pending_review'; end if;
end;
$$;

revoke all on function public.admin_reject_registration(uuid,text) from public;
grant execute on function public.admin_reject_registration(uuid,text) to authenticated;

notify pgrst,'reload schema';
