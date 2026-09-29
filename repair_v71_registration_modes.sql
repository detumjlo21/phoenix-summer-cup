-- Phoenix Cup: registration modes (free approval or bank transfer)
alter table public.tournament_payment_settings
  add column if not exists registration_mode text not null default 'payment'
  check (registration_mode in ('free','payment'));

create or replace function public.create_free_registration_request(
  p_game_name text, p_facebook_name text
) returns table(request_code text, amount bigint, content text, status text)
language plpgsql security definer set search_path=public as $$
declare v_code text; v_players integer; v_pending integer;
begin
  perform pg_advisory_xact_lock(20260949);
  if not coalesce((select registration_open from public.tournament_settings where id=1),true)
    then raise exception 'registration_closed_by_admin'; end if;
  if (select registration_deadline from public.tournament_settings where id=1) is not null
     and now() >= (select registration_deadline from public.tournament_settings where id=1)
    then raise exception 'registration_deadline_passed'; end if;
  if char_length(trim(coalesce(p_game_name,''))) not between 2 and 40 then raise exception 'invalid_game_name'; end if;
  if char_length(trim(coalesce(p_facebook_name,''))) not between 2 and 80 then raise exception 'invalid_facebook_name'; end if;
  if exists(select 1 from public.players where lower(game_name)=lower(trim(p_game_name))) then raise exception 'duplicate_game_name'; end if;
  if exists(select 1 from public.players where lower(facebook_name)=lower(trim(p_facebook_name))) then raise exception 'duplicate_facebook_name'; end if;
  if exists(select 1 from public.registration_requests where status in ('pending_payment','pending_review') and lower(game_name)=lower(trim(p_game_name))) then raise exception 'duplicate_pending_game_name'; end if;
  if exists(select 1 from public.registration_requests where status in ('pending_payment','pending_review') and lower(facebook_name)=lower(trim(p_facebook_name))) then raise exception 'duplicate_pending_facebook_name'; end if;
  select count(*) into v_players from public.players;
  select count(*) into v_pending from public.registration_requests where status in ('pending_payment','pending_review');
  if v_players+v_pending>=48 then raise exception 'tournament_full_pending'; end if;
  v_code := upper('PSC26-'||substr(md5(clock_timestamp()::text||random()::text||p_game_name||p_facebook_name),1,8));
  insert into public.registration_requests(request_code,game_name,facebook_name,payment_amount,payment_reference,status)
  values(v_code,trim(p_game_name),trim(p_facebook_name),0,'ĐĂNG KÝ MIỄN PHÍ','pending_review');
  return query select v_code,0::bigint,'','pending_review'::text;
end $$;
revoke all on function public.create_free_registration_request(text,text) from public;
grant execute on function public.create_free_registration_request(text,text) to anon,authenticated;
notify pgrst,'reload schema';
