-- PHOENIX SUMMER CUP V10 STABLE
-- Chạy toàn bộ file này trong Supabase SQL Editor.

-- 1. Sửa hàm đăng ký để mã đăng ký không bao giờ bị trùng.
drop function if exists public.register_player_random_team(text,text);

create or replace function public.register_player_random_team(
  p_game_name text,
  p_facebook_name text
)
returns table(
  team_number integer,
  team_name text,
  registration_code text
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_total integer;
  v_team integer;
  v_code text;
  v_next_number integer;
  v_max_team integer;
begin
  perform pg_advisory_xact_lock(20260730);

  if now()>=timestamptz '2026-07-30 23:59:59+07' then
    raise exception 'registration_closed';
  end if;

  select count(*) into v_total from public.players;
  if v_total>=55 then raise exception 'tournament_full'; end if;

  if char_length(trim(p_game_name))<2 then raise exception 'invalid_game_name'; end if;
  if char_length(trim(p_facebook_name))<2 then raise exception 'invalid_facebook_name'; end if;

  if exists(
    select 1 from public.players
    where lower(game_name)=lower(trim(p_game_name))
  ) then
    raise exception 'duplicate_game_name';
  end if;

  if exists(
    select 1 from public.players
    where lower(facebook_name)=lower(trim(p_facebook_name))
  ) then
    raise exception 'duplicate_facebook_name';
  end if;

  v_max_team:=case when v_total<40 then 10 else 14 end;

  with counts as(
    select t.team_number,count(p.id)::integer member_count
    from public.team_names t
    left join public.players p on p.team_number=t.team_number
    where t.team_number<=v_max_team
    group by t.team_number
    having count(p.id)<4
  ),
  minimum as(
    select min(member_count) min_count from counts
  )
  select c.team_number into v_team
  from counts c,minimum m
  where c.member_count=m.min_count
  order by random()
  limit 1;

  if v_team is null then raise exception 'tournament_full'; end if;

  select coalesce(
    max(
      case
        when registration_code ~ '^PSC2026-[0-9]+$'
        then substring(registration_code from '[0-9]+$')::integer
        else null
      end
    ),
    0
  )+1
  into v_next_number
  from public.players;

  v_code:='PSC2026-'||lpad(v_next_number::text,3,'0');

  insert into public.players(
    game_name,
    facebook_name,
    uid,
    facebook_url,
    team_number,
    registration_code
  )
  values(
    trim(p_game_name),
    trim(p_facebook_name),
    null,
    null,
    v_team,
    v_code
  );

  return query
  select v_team,t.name,v_code
  from public.team_names t
  where t.team_number=v_team;
end;
$$;

revoke all on function public.register_player_random_team(text,text) from public;
grant execute on function public.register_player_random_team(text,text) to anon,authenticated;

-- 2. Admin chuyển đội an toàn.
create or replace function public.admin_move_player(
  p_player_id uuid,
  p_target_team integer
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer;
begin
  if not exists(
    select 1 from public.admins where user_id=auth.uid()
  ) then
    raise exception 'not_admin';
  end if;

  if not exists(
    select 1 from public.players where id=p_player_id
  ) then
    raise exception 'player_not_found';
  end if;

  if not exists(
    select 1 from public.team_names where team_number=p_target_team
  ) then
    raise exception 'invalid_team';
  end if;

  perform pg_advisory_xact_lock(20260731);

  select count(*) into v_count
  from public.players
  where team_number=p_target_team
    and id<>p_player_id;

  if v_count>=4 then
    raise exception 'team_full';
  end if;

  update public.players
  set team_number=p_target_team
  where id=p_player_id;
end;
$$;

revoke all on function public.admin_move_player(uuid,integer) from public;
grant execute on function public.admin_move_player(uuid,integer) to authenticated;

-- 3. Admin random lại toàn bộ đội.
create or replace function public.admin_rerandom_all_players()
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  r record;
  v_team_numbers integer[];
  v_index integer:=1;
  v_player_count integer;
begin
  if not exists(
    select 1 from public.admins where user_id=auth.uid()
  ) then
    raise exception 'not_admin';
  end if;

  perform pg_advisory_xact_lock(20260732);

  select count(*) into v_player_count from public.players;
  if v_player_count>55 then
    raise exception 'too_many_players';
  end if;

  select array_agg(team_number order by random())
  into v_team_numbers
  from (
    select t.team_number
    from public.team_names t
    cross join generate_series(1,4)
    order by random()
    limit v_player_count
  ) x;

  for r in
    select id
    from public.players
    order by random()
  loop
    update public.players
    set team_number=v_team_numbers[v_index]
    where id=r.id;

    v_index:=v_index+1;
  end loop;
end;
$$;

revoke all on function public.admin_rerandom_all_players() from public;
grant execute on function public.admin_rerandom_all_players() to authenticated;

notify pgrst,'reload schema';
