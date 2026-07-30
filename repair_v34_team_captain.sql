-- PHOENIX V34 - TEAM CAPTAIN
-- Mỗi đội có tối đa một đội trưởng.

alter table public.team_names
add column if not exists captain_player_id uuid;

do $$
begin
  if not exists(
    select 1
    from pg_constraint
    where conname='team_names_captain_player_id_fkey'
  ) then
    alter table public.team_names
    add constraint team_names_captain_player_id_fkey
    foreign key(captain_player_id)
    references public.players(id)
    on delete set null;
  end if;
end $$;

create or replace function public.admin_set_team_captain(
  p_team_number integer,
  p_player_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  player_team integer;
begin
  if not public.is_phoenix_admin() then
    raise exception 'not_admin';
  end if;

  if p_team_number not between 1 and 12 then
    raise exception 'Đội không hợp lệ.';
  end if;

  if p_player_id is not null then
    select team_number
    into player_team
    from public.players
    where id=p_player_id;

    if player_team is null then
      raise exception 'Không tìm thấy tuyển thủ.';
    end if;

    if player_team<>p_team_number then
      raise exception 'Tuyển thủ không thuộc đội này.';
    end if;
  end if;

  update public.team_names
  set
    captain_player_id=p_player_id,
    updated_at=now()
  where team_number=p_team_number;
end;
$$;

grant execute on function public.admin_set_team_captain(integer,uuid)
to authenticated;


create or replace function public.admin_move_player_safe(
  p_player_id uuid,
  p_target_team integer
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  current_team integer;
  target_count integer;
begin
  if not public.is_phoenix_admin() then
    raise exception 'not_admin';
  end if;

  if p_target_team not between 1 and 12 then
    raise exception 'Đội đích không hợp lệ.';
  end if;

  select team_number
  into current_team
  from public.players
  where id=p_player_id
  for update;

  if current_team is null then
    raise exception 'Không tìm thấy tuyển thủ.';
  end if;

  if current_team=p_target_team then
    return;
  end if;

  select count(*)
  into target_count
  from public.players
  where team_number=p_target_team;

  if target_count>=4 then
    raise exception 'Đội đích đã đủ 4 người. Hãy đổi chỗ với một tuyển thủ.';
  end if;

  update public.players
  set team_number=p_target_team
  where id=p_player_id;

  update public.team_names
  set captain_player_id=null,updated_at=now()
  where team_number=current_team
    and captain_player_id=p_player_id;
end;
$$;

grant execute on function public.admin_move_player_safe(uuid,integer)
to authenticated;


create or replace function public.admin_swap_players(
  p_player_a uuid,
  p_player_b uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  team_a integer;
  team_b integer;
begin
  if not public.is_phoenix_admin() then
    raise exception 'not_admin';
  end if;

  if p_player_a is null or p_player_b is null then
    raise exception 'Thiếu tuyển thủ cần đổi.';
  end if;

  if p_player_a=p_player_b then
    return;
  end if;

  perform 1
  from public.players
  where id in(p_player_a,p_player_b)
  order by id
  for update;

  select team_number into team_a
  from public.players
  where id=p_player_a;

  select team_number into team_b
  from public.players
  where id=p_player_b;

  if team_a is null or team_b is null then
    raise exception 'Không tìm thấy một trong hai tuyển thủ.';
  end if;

  if team_a=team_b then
    raise exception 'Hai tuyển thủ đang ở cùng một đội.';
  end if;

  update public.players
  set team_number=case
    when id=p_player_a then team_b
    when id=p_player_b then team_a
    else team_number
  end
  where id in(p_player_a,p_player_b);

  update public.team_names
  set captain_player_id=null,updated_at=now()
  where
    (team_number=team_a and captain_player_id=p_player_a)
    or
    (team_number=team_b and captain_player_id=p_player_b);
end;
$$;

grant execute on function public.admin_swap_players(uuid,uuid)
to authenticated;


create or replace function public.admin_delete_player_safe(
  p_player_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  found_player boolean;
begin
  if not public.is_phoenix_admin() then
    raise exception 'not_admin';
  end if;

  select exists(
    select 1 from public.players where id=p_player_id
  ) into found_player;

  if not found_player then
    raise exception 'Không tìm thấy tuyển thủ.';
  end if;

  update public.team_names
  set captain_player_id=null,updated_at=now()
  where captain_player_id=p_player_id;

  delete from public.player_match_results
  where player_id=p_player_id;

  delete from public.champion_character_images
  where player_id=p_player_id;

  update public.champion_seasons
  set mvp_player_id=null
  where mvp_player_id=p_player_id;

  delete from public.players
  where id=p_player_id;
end;
$$;

grant execute on function public.admin_delete_player_safe(uuid)
to authenticated;

notify pgrst,'reload schema';
