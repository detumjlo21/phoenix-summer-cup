-- PHOENIX V28 - BACKUP, RESTORE, NEW SEASON
-- Chạy sau các file SQL V20-V27.
-- Không xóa Hall of Champions khi tạo mùa giải mới.

create table if not exists public.tournament_backups(
  id bigint generated always as identity primary key,
  backup_data jsonb not null,
  reason text not null default 'manual',
  created_at timestamptz not null default now()
);

alter table public.tournament_backups enable row level security;

drop policy if exists "admins read tournament backups" on public.tournament_backups;
create policy "admins read tournament backups"
on public.tournament_backups
for select to authenticated
using(public.is_phoenix_admin());

grant select on public.tournament_backups to authenticated;


create or replace function public.admin_export_tournament_backup()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  result jsonb;
begin
  if not public.is_phoenix_admin() then
    raise exception 'not_admin';
  end if;

  result=jsonb_build_object(
    'app','phoenix-summer-cup',
    'version',28,
    'created_at',now(),
    'data',jsonb_build_object(
      'players',coalesce((
        select jsonb_agg(to_jsonb(x) order by x.created_at,x.id)
        from public.players x
      ),'[]'::jsonb),

      'team_names',coalesce((
        select jsonb_agg(to_jsonb(x) order by x.team_number)
        from public.team_names x
      ),'[]'::jsonb),

      'tournament_settings',coalesce((
        select jsonb_agg(to_jsonb(x) order by x.id)
        from public.tournament_settings x
      ),'[]'::jsonb),

      'match_schedule',coalesce((
        select jsonb_agg(to_jsonb(x) order by x.match_number)
        from public.match_schedule x
      ),'[]'::jsonb),

      'match_results',coalesce((
        select jsonb_agg(to_jsonb(x) order by x.match_number,x.team_number)
        from public.match_results x
      ),'[]'::jsonb),

      'match_publication',coalesce((
        select jsonb_agg(to_jsonb(x) order by x.match_number)
        from public.match_publication x
      ),'[]'::jsonb),

      'player_match_results',coalesce((
        select jsonb_agg(to_jsonb(x) order by x.match_number,x.player_id)
        from public.player_match_results x
      ),'[]'::jsonb),

      'mvp_settings',coalesce((
        select jsonb_agg(to_jsonb(x) order by x.id)
        from public.mvp_settings x
      ),'[]'::jsonb),

      'champion_character_images',coalesce((
        select jsonb_agg(to_jsonb(x) order by x.player_id)
        from public.champion_character_images x
      ),'[]'::jsonb),

      'champion_seasons',coalesce((
        select jsonb_agg(to_jsonb(x) order by x.season_date,x.id)
        from public.champion_seasons x
      ),'[]'::jsonb)
    )
  );

  return result;
end;
$$;

grant execute on function public.admin_export_tournament_backup() to authenticated;


create or replace function public.admin_restore_tournament_backup(
  p_backup jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  payload jsonb;
begin
  if not public.is_phoenix_admin() then
    raise exception 'not_admin';
  end if;

  if p_backup->>'app' is distinct from 'phoenix-summer-cup' then
    raise exception 'invalid_backup_file';
  end if;

  payload:=p_backup->'data';

  if payload is null then
    raise exception 'missing_backup_data';
  end if;

  -- Lưu snapshot hiện tại trước khi ghi đè.
  insert into public.tournament_backups(backup_data,reason)
  values(public.admin_export_tournament_backup(),'before_restore');

  -- Xóa theo thứ tự phụ thuộc khóa ngoại.
  delete from public.player_match_results;
  delete from public.champion_character_images;
  delete from public.match_results;
  delete from public.players;
  delete from public.match_publication;
  delete from public.match_schedule;
  delete from public.mvp_settings;
  delete from public.tournament_settings;
  delete from public.champion_seasons;
  delete from public.team_names;

  -- Khôi phục bảng gốc.
  insert into public.team_names
  select * from jsonb_populate_recordset(
    null::public.team_names,
    coalesce(payload->'team_names','[]'::jsonb)
  );

  insert into public.players
  select * from jsonb_populate_recordset(
    null::public.players,
    coalesce(payload->'players','[]'::jsonb)
  );

  insert into public.tournament_settings
  select * from jsonb_populate_recordset(
    null::public.tournament_settings,
    coalesce(payload->'tournament_settings','[]'::jsonb)
  );

  insert into public.match_schedule
  select * from jsonb_populate_recordset(
    null::public.match_schedule,
    coalesce(payload->'match_schedule','[]'::jsonb)
  );

  insert into public.match_publication
  select * from jsonb_populate_recordset(
    null::public.match_publication,
    coalesce(payload->'match_publication','[]'::jsonb)
  );

  insert into public.match_results
  select * from jsonb_populate_recordset(
    null::public.match_results,
    coalesce(payload->'match_results','[]'::jsonb)
  );

  insert into public.player_match_results
  select * from jsonb_populate_recordset(
    null::public.player_match_results,
    coalesce(payload->'player_match_results','[]'::jsonb)
  );

  insert into public.mvp_settings
  select * from jsonb_populate_recordset(
    null::public.mvp_settings,
    coalesce(payload->'mvp_settings','[]'::jsonb)
  );

  insert into public.champion_character_images
  select * from jsonb_populate_recordset(
    null::public.champion_character_images,
    coalesce(payload->'champion_character_images','[]'::jsonb)
  );

  insert into public.champion_seasons overriding system value
  select * from jsonb_populate_recordset(
    null::public.champion_seasons,
    coalesce(payload->'champion_seasons','[]'::jsonb)
  );

  -- Đảm bảo dữ liệu mặc định luôn tồn tại.
  insert into public.tournament_settings(id,registration_open,announcement)
  values(1,true,'')
  on conflict(id) do nothing;

  insert into public.mvp_settings(id)
  values(1)
  on conflict(id) do nothing;

  insert into public.match_schedule(match_number)
  select value from generate_series(1,4)
  on conflict(match_number) do nothing;

  insert into public.match_publication(match_number)
  select value from generate_series(1,4)
  on conflict(match_number) do nothing;
end;
$$;

grant execute on function public.admin_restore_tournament_backup(jsonb) to authenticated;


create or replace function public.admin_start_new_season(
  p_keep_teams boolean default true
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_phoenix_admin() then
    raise exception 'not_admin';
  end if;

  -- Tự động lưu backup trước khi reset.
  insert into public.tournament_backups(backup_data,reason)
  values(public.admin_export_tournament_backup(),'before_new_season');

  delete from public.player_match_results;
  delete from public.match_results;
  delete from public.match_result_snapshots;

  update public.match_publication
  set
    is_published=false,
    is_locked=false,
    published_at=null,
    updated_at=now();

  update public.match_schedule
  set
    map_name=null,
    match_date=null,
    match_time=null,
    is_current=false,
    updated_at=now();

  update public.tournament_settings
  set
    registration_open=true,
    announcement='',
    updated_at=now()
  where id=1;

  -- Giữ ảnh nhân vật MVP chung để có thể tái sử dụng,
  -- nhưng dữ liệu Kill đã được xóa nên MVP trở về trạng thái chờ.

  if not p_keep_teams then
    delete from public.champion_character_images;
    delete from public.players;

    update public.team_names
    set
      name='Đội '||team_number,
      logo_url=null,
      updated_at=now()
    where team_number between 1 and 12;
  end if;
end;
$$;

grant execute on function public.admin_start_new_season(boolean) to authenticated;

notify pgrst,'reload schema';
