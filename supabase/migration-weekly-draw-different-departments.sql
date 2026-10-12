-- Weekly prize draws must pick their two winners from different departments.
-- Patrick approved this rule on 2026-10-12. Departments are compared after
-- normalization so variants such as "People & Culture" and
-- "People and Culture" count as the same department.

begin;

create schema if not exists private;

create or replace function private.normalize_department(p_department text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(btrim(regexp_replace(replace(coalesce(p_department, ''), '&', ' and '), '\s+', ' ', 'g')));
$$;

revoke all on function private.normalize_department(text) from public, anon, authenticated, service_role;

create or replace function public.run_weekly_draw(p_week integer)
returns table(winner_name text, winner_business_unit text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draw_key text;
  v_eligible integer;
  v_departments integer;
  v_first uuid;
  v_first_department text;
  v_second uuid;
  v_user uuid;
begin
  perform public.require_current_user_admin();

  if p_week not between 1 and 4 then
    raise exception using errcode = '22023', message = 'Week must be between 1 and 4.';
  end if;
  v_draw_key := 'week' || p_week;

  select count(*)::integer, count(distinct private.normalize_department(p.business_unit))::integer
  into v_eligible, v_departments
  from public.profiles p
  where public.user_week_points(p.id, p_week) >= 140
    and public.user_has_activity_in_week(p.id, p_week)
    and not p.exclude_from_prizes
    and private.normalize_department(p.business_unit) <> ''
    and not exists (
      select 1 from public.draw_results d where d.user_id = p.id
    );

  if v_eligible < 2 then
    raise exception 'Week % needs 2 eligible participants with 140+ points and a logged wellness activity; only % available.', p_week, v_eligible;
  end if;
  if v_departments < 2 then
    raise exception 'Week % needs eligible participants from at least 2 departments; only % department available.', p_week, v_departments;
  end if;

  begin
    insert into public.draw_runs (draw_key, run_by) values (v_draw_key, auth.uid());
  exception when unique_violation then
    raise exception 'Week % draw has already been run.', p_week;
  end;

  select p.id, private.normalize_department(p.business_unit)
  into v_first, v_first_department
  from public.profiles p
  where public.user_week_points(p.id, p_week) >= 140
    and public.user_has_activity_in_week(p.id, p_week)
    and not p.exclude_from_prizes
    and private.normalize_department(p.business_unit) <> ''
    and not exists (
      select 1 from public.draw_results d where d.user_id = p.id
    )
  order by random()
  limit 1;

  select p.id
  into v_second
  from public.profiles p
  where public.user_week_points(p.id, p_week) >= 140
    and public.user_has_activity_in_week(p.id, p_week)
    and not p.exclude_from_prizes
    and private.normalize_department(p.business_unit) <> ''
    and private.normalize_department(p.business_unit) <> v_first_department
    and not exists (
      select 1 from public.draw_results d where d.user_id = p.id
    )
  order by random()
  limit 1;

  if v_first is null or v_second is null then
    raise exception 'Week % could not select 2 winners from different departments.', p_week;
  end if;

  foreach v_user in array array[v_first, v_second]
  loop
    insert into public.draw_results (draw_key, user_id) values (v_draw_key, v_user);
    winner_name := (select p.full_name from public.profiles p where p.id = v_user);
    winner_business_unit := (select p.business_unit from public.profiles p where p.id = v_user);
    return next;
  end loop;
end;
$$;

revoke all on function public.run_weekly_draw(integer) from public, anon, authenticated;
grant execute on function public.run_weekly_draw(integer) to authenticated;

commit;
