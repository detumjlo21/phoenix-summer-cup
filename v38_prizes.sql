-- PHOENIX V38 - KHU VỰC GIẢI THƯỞNG
create table if not exists public.tournament_prizes(
  id integer primary key default 1 check(id=1),
  title text not null default 'CƠ CẤU GIẢI THƯỞNG',
  subtitle text not null default 'Phoenix Summer Cup 2026 • Mùa 1',
  total_pool text not null default 'Đang cập nhật',
  champion_prize text not null default 'Đang cập nhật',
  runner_up_prize text not null default 'Đang cập nhật',
  third_prize text not null default 'Đang cập nhật',
  mvp_prize text not null default 'Đang cập nhật',
  extra_note text not null default 'Giải thưởng sẽ được Ban tổ chức trao sau khi giải đấu kết thúc.',
  is_visible boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.tournament_prizes(id) values(1)
on conflict(id) do nothing;

alter table public.tournament_prizes enable row level security;

drop policy if exists "public read tournament prizes" on public.tournament_prizes;
create policy "public read tournament prizes"
on public.tournament_prizes for select to anon,authenticated using(true);

drop policy if exists "admins manage tournament prizes" on public.tournament_prizes;
create policy "admins manage tournament prizes"
on public.tournament_prizes for all to authenticated
using(public.is_phoenix_admin())
with check(public.is_phoenix_admin());

grant select on public.tournament_prizes to anon,authenticated;
grant insert,update on public.tournament_prizes to authenticated;

create or replace function public.admin_save_tournament_prizes(
  p_title text,
  p_subtitle text,
  p_total_pool text,
  p_champion_prize text,
  p_runner_up_prize text,
  p_third_prize text,
  p_mvp_prize text,
  p_extra_note text,
  p_is_visible boolean
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

  insert into public.tournament_prizes(
    id,title,subtitle,total_pool,champion_prize,runner_up_prize,
    third_prize,mvp_prize,extra_note,is_visible,updated_at
  )
  values(
    1,
    coalesce(nullif(trim(p_title),''),'CƠ CẤU GIẢI THƯỞNG'),
    coalesce(nullif(trim(p_subtitle),''),'Phoenix Summer Cup 2026 • Mùa 1'),
    coalesce(nullif(trim(p_total_pool),''),'Đang cập nhật'),
    coalesce(nullif(trim(p_champion_prize),''),'Đang cập nhật'),
    coalesce(nullif(trim(p_runner_up_prize),''),'Đang cập nhật'),
    coalesce(nullif(trim(p_third_prize),''),'Đang cập nhật'),
    coalesce(nullif(trim(p_mvp_prize),''),'Đang cập nhật'),
    coalesce(trim(p_extra_note),''),
    coalesce(p_is_visible,true),
    now()
  )
  on conflict(id) do update set
    title=excluded.title,
    subtitle=excluded.subtitle,
    total_pool=excluded.total_pool,
    champion_prize=excluded.champion_prize,
    runner_up_prize=excluded.runner_up_prize,
    third_prize=excluded.third_prize,
    mvp_prize=excluded.mvp_prize,
    extra_note=excluded.extra_note,
    is_visible=excluded.is_visible,
    updated_at=now();
end;
$$;

grant execute on function public.admin_save_tournament_prizes(
  text,text,text,text,text,text,text,text,boolean
) to authenticated;

notify pgrst,'reload schema';
