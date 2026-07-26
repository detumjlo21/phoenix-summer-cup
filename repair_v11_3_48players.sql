-- PHOENIX SUMMER CUP V11.3
-- Tối đa 48 người = 12 đội, mỗi đội tối đa 4 người.

insert into public.team_names(team_number,name)
select n,'Đội '||n from generate_series(1,12)n
on conflict(team_number) do nothing;

do $$
declare r record; v_target integer;
begin
  for r in select id from public.players where team_number>12 order by created_at,id loop
    select t.team_number into v_target
    from public.team_names t
    left join public.players p on p.team_number=t.team_number
    where t.team_number between 1 and 12
    group by t.team_number
    having count(p.id)<4
    order by count(p.id),random()
    limit 1;

    if v_target is null then
      raise exception 'Không đủ chỗ trong 12 đội';
    end if;

    update public.players set team_number=v_target where id=r.id;
  end loop;
end $$;

delete from public.team_names
where team_number>12
and not exists(
  select 1 from public.players p
  where p.team_number=team_names.team_number
);

drop function if exists public.register_player_random_team(text,text);

create function public.register_player_random_team(
  p_game_name text,
  p_facebook_name text
)
returns table(
  team_number integer,
  team_name text,
  logo_url text,
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
begin
  perform pg_advisory_xact_lock(20260730);

  if now()>=timestamptz '2026-07-30 23:59:59+07' then
    raise exception 'registration_closed';
  end if;

  select count(*) into v_total from public.players;
  if v_total>=48 then raise exception 'tournament_full'; end if;

  if char_length(trim(p_game_name))<2 then raise exception 'invalid_game_name'; end if;
  if char_length(trim(p_facebook_name))<2 then raise exception 'invalid_facebook_name'; end if;

  if exists(select 1 from public.players p where lower(p.game_name)=lower(trim(p_game_name))) then
    raise exception 'duplicate_game_name';
  end if;

  if exists(select 1 from public.players p where lower(p.facebook_name)=lower(trim(p_facebook_name))) then
    raise exception 'duplicate_facebook_name';
  end if;

  with counts as(
    select t.team_number,count(p.id)::integer member_count
    from public.team_names t
    left join public.players p on p.team_number=t.team_number
    where t.team_number between 1 and 12
    group by t.team_number
    having count(p.id)<4
  ),
  minimum as(select min(member_count) min_count from counts)
  select c.team_number into v_team
  from counts c,minimum m
  where c.member_count=m.min_count
  order by random()
  limit 1;

  if v_team is null then raise exception 'tournament_full'; end if;

  select coalesce(max(
    case
      when p.registration_code ~ '^PSC2026-[0-9]+$'
      then substring(p.registration_code from '[0-9]+$')::integer
      else null
    end
  ),0)+1
  into v_next_number
  from public.players p;

  v_code='PSC2026-'||lpad(v_next_number::text,3,'0');

  insert into public.players(
    game_name,facebook_name,uid,facebook_url,team_number,registration_code
  )
  values(
    trim(p_game_name),trim(p_facebook_name),null,null,v_team,v_code
  );

  return query
  select v_team,t.name,t.logo_url,v_code
  from public.team_names t
  where t.team_number=v_team;
end;
$$;

revoke all on function public.register_player_random_team(text,text) from public;
grant execute on function public.register_player_random_team(text,text) to anon,authenticated;

create or replace function public.admin_move_player(
  p_player_id uuid,
  p_target_team integer
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_count integer;
begin
  if not exists(select 1 from public.admins where user_id=auth.uid()) then
    raise exception 'not_admin';
  end if;

  if p_target_team<1 or p_target_team>12 then
    raise exception 'invalid_team';
  end if;

  select count(*) into v_count
  from public.players
  where team_number=p_target_team and id<>p_player_id;

  if v_count>=4 then raise exception 'team_full'; end if;

  update public.players set team_number=p_target_team where id=p_player_id;
end;
$$;

revoke all on function public.admin_move_player(uuid,integer) from public;
grant execute on function public.admin_move_player(uuid,integer) to authenticated;

create or replace function public.admin_rerandom_all_players()
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  r record;
  v_slots integer[];
  v_index integer:=1;
  v_player_count integer;
begin
  if not exists(select 1 from public.admins where user_id=auth.uid()) then
    raise exception 'not_admin';
  end if;

  select count(*) into v_player_count from public.players;
  if v_player_count>48 then raise exception 'too_many_players'; end if;

  select array_agg(team_number order by random())
  into v_slots
  from (
    select t.team_number
    from public.team_names t
    cross join generate_series(1,4)
    where t.team_number between 1 and 12
    order by random()
    limit v_player_count
  ) s;

  for r in select id from public.players order by random() loop
    update public.players set team_number=v_slots[v_index] where id=r.id;
    v_index:=v_index+1;
  end loop;
end;
$$;

revoke all on function public.admin_rerandom_all_players() from public;
grant execute on function public.admin_rerandom_all_players() to authenticated;

notify pgrst,'reload schema';
