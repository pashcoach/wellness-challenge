-- One-time correction for a weekly prize draw whose two winners share a
-- department. Patrick approved this rule on 2026-10-12: keep one current winner
-- at random and replace the other with an eligible participant from another
-- department. The audit ledger stores IDs only and is never exposed to the API.

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

create table if not exists private.prize_draw_department_corrections (
  draw_key text primary key check (draw_key ~ '^week[1-4]$'),
  kept_result_id uuid not null,
  kept_user_id uuid not null,
  removed_result_id uuid not null,
  removed_user_id uuid not null,
  removed_drawn_at timestamptz not null,
  replacement_result_id uuid not null,
  replacement_user_id uuid not null,
  shared_department text not null,
  replacement_department text not null,
  eligible_replacement_count integer not null check (eligible_replacement_count > 0),
  reason text not null default 'Winners must be from different departments.',
  approved_by text not null default 'Patrick',
  corrected_at timestamptz not null default clock_timestamp(),
  check (kept_user_id <> removed_user_id),
  check (replacement_user_id <> kept_user_id),
  check (replacement_user_id <> removed_user_id)
);

alter table private.prize_draw_department_corrections enable row level security;
revoke all on table private.prize_draw_department_corrections from public, anon, authenticated, service_role;

create or replace function public.admin_correct_weekly_draw_department_conflict(p_week integer)
returns table (winner_status text, winner_name text, winner_business_unit text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draw_key text;
  v_result_count integer;
  v_department_count integer;
  v_kept record;
  v_removed record;
  v_kept_department text;
  v_replacement_user uuid;
  v_replacement_department text;
  v_replacement_result uuid;
  v_eligible integer;
  v_final_count integer;
  v_final_departments integer;
begin
  if p_week not between 1 and 4 then
    raise exception using errcode = '22023', message = 'Week must be between 1 and 4.';
  end if;
  v_draw_key := 'week' || p_week;

  perform 1 from public.draw_runs r where r.draw_key = v_draw_key for update;
  if not found then
    raise exception 'Week % draw has not been run.', p_week;
  end if;

  if exists (
    select 1 from private.prize_draw_department_corrections c where c.draw_key = v_draw_key
  ) then
    raise exception 'Week % draw has already been corrected.', p_week;
  end if;

  perform d.id from public.draw_results d where d.draw_key = v_draw_key order by d.id for update;

  select count(*)::integer, count(distinct private.normalize_department(p.business_unit))::integer
  into v_result_count, v_department_count
  from public.draw_results d
  join public.profiles p on p.id = d.user_id
  where d.draw_key = v_draw_key;

  if v_result_count <> 2 then
    raise exception 'Week % must have exactly 2 recorded winners; found %.', p_week, v_result_count;
  end if;
  if v_department_count <> 1 then
    raise exception 'Week % winners are already from different departments.', p_week;
  end if;

  select d.id, d.user_id, d.drawn_at, p.business_unit
  into v_kept
  from public.draw_results d
  join public.profiles p on p.id = d.user_id
  where d.draw_key = v_draw_key
  order by random()
  limit 1;

  select d.id, d.user_id, d.drawn_at, p.business_unit
  into v_removed
  from public.draw_results d
  join public.profiles p on p.id = d.user_id
  where d.draw_key = v_draw_key
    and d.id <> v_kept.id;

  v_kept_department := private.normalize_department(v_kept.business_unit);

  select count(*)::integer into v_eligible
  from public.profiles p
  where public.user_week_points(p.id, p_week) >= 140
    and public.user_has_activity_in_week(p.id, p_week)
    and not p.exclude_from_prizes
    and private.normalize_department(p.business_unit) <> ''
    and private.normalize_department(p.business_unit) <> v_kept_department
    and not exists (
      select 1 from public.draw_results d where d.user_id = p.id
    );

  if v_eligible < 1 then
    raise exception 'Week % has no eligible replacement from another department.', p_week;
  end if;

  select p.id, p.business_unit
  into v_replacement_user, v_replacement_department
  from public.profiles p
  where public.user_week_points(p.id, p_week) >= 140
    and public.user_has_activity_in_week(p.id, p_week)
    and not p.exclude_from_prizes
    and private.normalize_department(p.business_unit) <> ''
    and private.normalize_department(p.business_unit) <> v_kept_department
    and not exists (
      select 1 from public.draw_results d where d.user_id = p.id
    )
  order by random()
  limit 1;

  delete from public.draw_results d
  where d.draw_key = v_draw_key
    and d.id = v_removed.id;

  insert into public.draw_results (draw_key, user_id)
  values (v_draw_key, v_replacement_user)
  returning id into v_replacement_result;

  insert into private.prize_draw_department_corrections (
    draw_key, kept_result_id, kept_user_id, removed_result_id, removed_user_id,
    removed_drawn_at, replacement_result_id, replacement_user_id, shared_department,
    replacement_department, eligible_replacement_count
  ) values (
    v_draw_key, v_kept.id, v_kept.user_id, v_removed.id, v_removed.user_id,
    v_removed.drawn_at, v_replacement_result, v_replacement_user, v_kept.business_unit,
    v_replacement_department, v_eligible
  );

  select count(*)::integer, count(distinct private.normalize_department(p.business_unit))::integer
  into v_final_count, v_final_departments
  from public.draw_results d
  join public.profiles p on p.id = d.user_id
  where d.draw_key = v_draw_key;

  if v_final_count <> 2 or v_final_departments <> 2 then
    raise exception 'Week % correction did not produce 2 winners from different departments.', p_week;
  end if;

  return query
  select case when d.id = v_kept.id then 'kept' else 'replacement' end,
         p.full_name,
         p.business_unit
  from public.draw_results d
  join public.profiles p on p.id = d.user_id
  where d.draw_key = v_draw_key
  order by case when d.id = v_kept.id then 0 else 1 end;
end;
$$;

revoke all on function private.normalize_department(text) from public, anon, authenticated, service_role;
revoke all on function public.admin_correct_weekly_draw_department_conflict(integer) from public, anon, authenticated, service_role;

commit;
