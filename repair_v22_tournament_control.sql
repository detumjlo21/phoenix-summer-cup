-- PHOENIX V22 - TOURNAMENT CONTROL

create table if not exists public.match_publication(
  match_number integer primary key check(match_number between 1 and 4),
  is_published boolean not null default false,
  is_locked boolean not null default false,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.match_publication(match_number)
values(1),(2),(3),(4)
on conflict(match_number) do nothing;

create table if not exists public.match_result_snapshots(
  id bigint generated always as identity primary key,
  match_number integer not null check(match_number between 1 and 4),
  snapshot jsonb not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.match_publication enable row level security;
alter table public.match_result_snapshots enable row level security;

drop policy if exists "public read match publication" on public.match_publication;
create policy "public read match publication"
on public.match_publication for select to anon,authenticated using(true);

drop policy if exists "admins manage match publication" on public.match_publication;
create policy "admins manage match publication"
on public.match_publication for all to authenticated
using(public.is_phoenix_admin())
with check(public.is_phoenix_admin());

drop policy if exists "admins read snapshots" on public.match_result_snapshots;
create policy "admins read snapshots"
on public.match_result_snapshots for select to authenticated
using(public.is_phoenix_admin());

grant select on public.match_publication to anon,authenticated;
grant insert,update,delete on public.match_publication to authenticated;
grant select on public.match_result_snapshots to authenticated;

create or replace function public.create_match_snapshot(
  p_match_number integer,
  p_reason text default 'Sao lưu tự động'
)
returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare
  snapshot_id bigint;
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;

  insert into public.match_result_snapshots(match_number,snapshot,reason)
  select
    p_match_number,
    coalesce(jsonb_agg(to_jsonb(r) order by r.team_number),'[]'::jsonb),
    p_reason
  from public.match_results r
  where r.match_number=p_match_number
  returning id into snapshot_id;

  return snapshot_id;
end;
$$;

create or replace function public.validate_match_results(
  p_match_number integer
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  problems text[]:=array[]::text[];
  team_count integer;
  placement_count integer;
  duplicate_placements text;
  negative_kills integer;
  team_kills integer;
  player_kills integer;
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;

  select count(*) into team_count
  from public.match_results
  where match_number=p_match_number;

  if team_count<>12 then
    problems:=array_append(problems,format('Cần đủ 12 đội, hiện có %s đội.',team_count));
  end if;

  select count(distinct placement) into placement_count
  from public.match_results
  where match_number=p_match_number
    and placement between 1 and 12;

  if placement_count<>12 then
    problems:=array_append(problems,'Top phải đủ từ 1 đến 12 và không được trùng.');
  end if;

  select string_agg(placement::text,', ')
  into duplicate_placements
  from (
    select placement
    from public.match_results
    where match_number=p_match_number
    group by placement
    having count(*)>1
  ) duplicates;

  if duplicate_placements is not null then
    problems:=array_append(problems,'Top bị trùng: '||duplicate_placements||'.');
  end if;

  select count(*) into negative_kills
  from public.match_results
  where match_number=p_match_number and kills<0;

  if negative_kills>0 then
    problems:=array_append(problems,'Kill không được âm.');
  end if;

  if to_regclass('public.player_match_results') is not null then
    select coalesce(sum(kills),0) into team_kills
    from public.match_results
    where match_number=p_match_number;

    select coalesce(sum(kills),0) into player_kills
    from public.player_match_results
    where match_number=p_match_number;

    if player_kills>0 and team_kills<>player_kills then
      problems:=array_append(
        problems,
        format('Tổng Kill đội (%s) không khớp tổng Kill cá nhân (%s).',team_kills,player_kills)
      );
    end if;
  end if;

  return jsonb_build_object(
    'valid',cardinality(problems)=0,
    'problems',to_jsonb(problems)
  );
end;
$$;

create or replace function public.publish_match_results(
  p_match_number integer
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare validation jsonb;
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;

  if exists(
    select 1 from public.match_publication
    where match_number=p_match_number and is_locked=true
  ) then
    raise exception 'match_locked';
  end if;

  validation:=public.validate_match_results(p_match_number);

  if not (validation->>'valid')::boolean then
    raise exception 'invalid_match_results';
  end if;

  perform public.create_match_snapshot(p_match_number,'Trước khi công bố');

  update public.match_publication
  set
    is_published=true,
    published_at=now(),
    updated_at=now()
  where match_number=p_match_number;
end;
$$;

create or replace function public.set_match_lock(
  p_match_number integer,
  p_locked boolean
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;

  if p_locked then
    perform public.create_match_snapshot(p_match_number,'Trước khi khóa');
  end if;

  update public.match_publication
  set is_locked=p_locked,updated_at=now()
  where match_number=p_match_number;
end;
$$;

create or replace function public.restore_match_snapshot(
  p_snapshot_id bigint
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  record public.match_result_snapshots%rowtype;
  item jsonb;
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;

  select * into record
  from public.match_result_snapshots
  where id=p_snapshot_id;

  if record.id is null then raise exception 'snapshot_not_found'; end if;

  perform public.create_match_snapshot(record.match_number,'Trước khi khôi phục');

  delete from public.match_results where match_number=record.match_number;

  for item in select * from jsonb_array_elements(record.snapshot)
  loop
    insert into public.match_results(
      match_number,team_number,placement,kills,total_points
    )
    values(
      (item->>'match_number')::integer,
      (item->>'team_number')::integer,
      (item->>'placement')::integer,
      (item->>'kills')::integer,
      (item->>'total_points')::integer
    );
  end loop;
end;
$$;

create or replace function public.restore_latest_match_snapshot(
  p_match_number integer
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare snapshot_id bigint;
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;

  select id into snapshot_id
  from public.match_result_snapshots
  where match_number=p_match_number
  order by created_at desc
  limit 1;

  if snapshot_id is null then raise exception 'no_snapshot'; end if;

  perform public.restore_match_snapshot(snapshot_id);
end;
$$;

drop function if exists public.get_public_match_results();

create function public.get_public_match_results()
returns table(
  match_number integer,
  team_number integer,
  placement integer,
  kills integer,
  total_points integer
)
language sql
security definer
set search_path=public
as $$
select
  r.match_number,
  r.team_number,
  r.placement,
  r.kills,
  r.total_points
from public.match_results r
join public.match_publication p
  on p.match_number=r.match_number
where p.is_published=true
order by r.match_number,r.team_number;
$$;

grant execute on function public.validate_match_results(integer) to authenticated;
grant execute on function public.publish_match_results(integer) to authenticated;
grant execute on function public.set_match_lock(integer,boolean) to authenticated;
grant execute on function public.restore_match_snapshot(bigint) to authenticated;
grant execute on function public.restore_latest_match_snapshot(integer) to authenticated;
grant execute on function public.get_public_match_results() to anon,authenticated;

drop function if exists public.get_public_match_mvps();

create function public.get_public_match_mvps()
returns table(
  match_number integer,
  player_id uuid,
  game_name text,
  team_number integer,
  team_name text,
  kills integer
)
language sql
security definer
set search_path=public
as $$
select distinct on (r.match_number)
  r.match_number,
  p.id,
  p.game_name,
  p.team_number,
  t.name,
  r.kills
from public.player_match_results r
join public.players p on p.id=r.player_id
left join public.team_names t on t.team_number=p.team_number
join public.match_publication publication
  on publication.match_number=r.match_number
where publication.is_published=true
order by r.match_number,r.kills desc,p.game_name;
$$;

grant execute on function public.get_public_match_mvps() to anon,authenticated;

notify pgrst,'reload schema';
