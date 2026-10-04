-- Prize draw repair — supports multiple winners and exactly-once execution

begin;

-- A draw has one run record and one or more winner records. The old unique
-- draw_key constraint incorrectly allowed only one winner per draw.
create table if not exists public.draw_runs (
  draw_key text primary key,
  run_at timestamptz not null default now(),
  run_by uuid references public.profiles(id) on delete set null
);

-- Preserve any historical draw as an already-completed run.
insert into public.draw_runs (draw_key, run_at)
select dr.draw_key, min(dr.drawn_at)
from public.draw_results dr
group by dr.draw_key
on conflict (draw_key) do nothing;

alter table public.draw_results
  drop constraint if exists draw_results_draw_key_key;

create unique index if not exists draw_results_draw_user_unique
  on public.draw_results (draw_key, user_id)
  where user_id is not null;

create unique index if not exists draw_results_draw_team_unique
  on public.draw_results (draw_key, team_id)
  where team_id is not null;

-- Direct result inserts are never allowed from the API; security-definer draw
-- functions own all writes.
drop policy if exists "draw_results_insert_function" on public.draw_results;
revoke insert, update, delete on table public.draw_results from anon, authenticated;

alter table public.draw_runs enable row level security;
revoke all on table public.draw_runs from anon;
grant select on table public.draw_runs to authenticated;
drop policy if exists "draw_runs_select_admin" on public.draw_runs;
create policy "draw_runs_select_admin"
on public.draw_runs
for select
to authenticated
using (public.current_user_is_admin());

create or replace function public.run_weekly_draw(p_week integer)
returns table (winner_name text, winner_business_unit text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draw_key text;
  v_user uuid;
  v_eligible integer;
begin
  perform public.require_current_user_admin();

  if p_week not between 1 and 4 then
    raise exception using errcode = '22023', message = 'Week must be between 1 and 4.';
  end if;
  v_draw_key := 'week' || p_week;

  select count(*) into v_eligible
  from public.profiles p
  where public.user_week_points(p.id, p_week) >= 140
    and not exists (
      select 1 from public.draw_results d where d.user_id = p.id
    );

  if v_eligible < 2 then
    raise exception 'Week % needs 2 eligible participants; only % available.', p_week, v_eligible;
  end if;

  begin
    insert into public.draw_runs (draw_key, run_by) values (v_draw_key, auth.uid());
  exception when unique_violation then
    raise exception 'Week % draw has already been run.', p_week;
  end;

  for v_user in
    select p.id
    from public.profiles p
    where public.user_week_points(p.id, p_week) >= 140
      and not exists (
        select 1 from public.draw_results d where d.user_id = p.id
      )
    order by random()
    limit 2
  loop
    insert into public.draw_results (draw_key, user_id) values (v_draw_key, v_user);
    winner_name := (select p.full_name from public.profiles p where p.id = v_user);
    winner_business_unit := (select p.business_unit from public.profiles p where p.id = v_user);
    return next;
  end loop;
end;
$$;

create or replace function public.run_grand_prize_draw()
returns table (winner_name text, winner_business_unit text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_eligible integer;
begin
  perform public.require_current_user_admin();

  select count(*) into v_eligible
  from public.profiles p
  where public.user_week_points(p.id, 1) >= 140
    and public.user_week_points(p.id, 2) >= 140
    and public.user_week_points(p.id, 3) >= 140
    and public.user_week_points(p.id, 4) >= 140
    and not exists (
      select 1 from public.draw_results d where d.user_id = p.id
    );

  if v_eligible < 2 then
    raise exception 'Grand prize needs 2 eligible participants; only % available.', v_eligible;
  end if;

  begin
    insert into public.draw_runs (draw_key, run_by) values ('grand', auth.uid());
  exception when unique_violation then
    raise exception 'Grand prize draw has already been run.';
  end;

  for v_user in
    select p.id
    from public.profiles p
    where public.user_week_points(p.id, 1) >= 140
      and public.user_week_points(p.id, 2) >= 140
      and public.user_week_points(p.id, 3) >= 140
      and public.user_week_points(p.id, 4) >= 140
      and not exists (
        select 1 from public.draw_results d where d.user_id = p.id
      )
    order by random()
    limit 2
  loop
    insert into public.draw_results (draw_key, user_id) values ('grand', v_user);
    winner_name := (select p.full_name from public.profiles p where p.id = v_user);
    winner_business_unit := (select p.business_unit from public.profiles p where p.id = v_user);
    return next;
  end loop;
end;
$$;

create or replace function public.run_random_team_draw()
returns table (team_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
begin
  perform public.require_current_user_admin();

  select t.id into v_team
  from public.teams t
  where exists (
    select 1
    from public.profiles p
    join public.activity_entries a on a.user_id = p.id
    where p.team_id = t.id
  )
  order by random()
  limit 1;

  if v_team is null then
    raise exception 'No teams with activity found for the random draw.';
  end if;

  begin
    insert into public.draw_runs (draw_key, run_by) values ('team_random', auth.uid());
  exception when unique_violation then
    raise exception 'Random team draw has already been run.';
  end;

  insert into public.draw_results (draw_key, team_id) values ('team_random', v_team);
  team_name := (select t.name from public.teams t where t.id = v_team);
  return next;
end;
$$;

revoke all on function public.run_weekly_draw(integer) from public, anon, authenticated;
revoke all on function public.run_grand_prize_draw() from public, anon, authenticated;
revoke all on function public.run_random_team_draw() from public, anon, authenticated;
grant execute on function public.run_weekly_draw(integer) to authenticated;
grant execute on function public.run_grand_prize_draw() to authenticated;
grant execute on function public.run_random_team_draw() to authenticated;

-- Admin prize history now comes from a security-invoker view so underlying RLS
-- remains effective. The id gives React a unique key for two winners in a draw.
drop view if exists public.draw_results_view;
create view public.draw_results_view
with (security_invoker = true)
as
select
  dr.id,
  dr.draw_key,
  dr.drawn_at,
  p.full_name as winner_name,
  p.business_unit as winner_business_unit,
  t.name as team_name
from public.draw_results dr
left join public.profiles p on p.id = dr.user_id
left join public.teams t on t.id = dr.team_id;

grant select on table public.draw_results_view to authenticated;
revoke all on table public.draw_results_view from anon;

-- Structural migration tests.
do $$
begin
  if to_regclass('public.draw_runs') is null then
    raise exception 'Prize repair self-test failed: draw_runs is missing';
  end if;
  if to_regclass('public.draw_results_draw_user_unique') is null
    or to_regclass('public.draw_results_draw_team_unique') is null then
    raise exception 'Prize repair self-test failed: winner indexes are missing';
  end if;
  if not exists (
    select 1
    from pg_class c
    where c.oid = 'public.draw_results_view'::regclass
      and c.reloptions @> array['security_invoker=true']
  ) then
    raise exception 'Prize repair self-test failed: view is not security-invoker';
  end if;
end;
$$;

commit;
