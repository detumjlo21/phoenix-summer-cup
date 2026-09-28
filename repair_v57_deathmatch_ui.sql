-- PHOENIX V57 — Deathmatch schedule + public standings support
alter table public.deathmatch_matches
  add column if not exists match_date date,
  add column if not exists match_time time;

create index if not exists deathmatch_matches_schedule_idx
  on public.deathmatch_matches(match_date,match_time,stage,group_code,match_order);

create or replace function public.admin_save_deathmatch_schedule(
  p_match_id bigint,
  p_match_date date,
  p_match_time time
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_phoenix_admin() then raise exception 'not_admin'; end if;
  update public.deathmatch_matches
  set match_date=p_match_date, match_time=p_match_time, updated_at=now()
  where id=p_match_id;
  if not found then raise exception 'match_not_found'; end if;
end;
$$;

grant execute on function public.admin_save_deathmatch_schedule(bigint,date,time) to authenticated;

notify pgrst,'reload schema';
