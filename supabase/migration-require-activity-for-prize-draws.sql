-- Require real activity participation for individual prize eligibility.

begin;

create or replace function public.user_has_activity_in_week(p_user uuid, p_week integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.activity_entries a
    where a.user_id = p_user
      and a.week = p_week
  );
$$;

revoke all on function public.user_has_activity_in_week(uuid, integer) from public, anon, authenticated;

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
    and public.user_has_activity_in_week(p.id, p_week)
    and not exists (
      select 1 from public.draw_results d where d.user_id = p.id
    );

  if v_eligible < 2 then
    raise exception 'Week % needs 2 eligible participants with 140+ points and a logged wellness activity; only % available.', p_week, v_eligible;
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
      and public.user_has_activity_in_week(p.id, p_week)
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
    and public.user_has_activity_in_week(p.id, 1)
    and public.user_has_activity_in_week(p.id, 2)
    and public.user_has_activity_in_week(p.id, 3)
    and public.user_has_activity_in_week(p.id, 4)
    and not exists (
      select 1 from public.draw_results d where d.user_id = p.id
    );

  if v_eligible < 2 then
    raise exception 'Grand prize needs 2 eligible participants with 140+ points and a logged wellness activity in every week; only % available.', v_eligible;
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
      and public.user_has_activity_in_week(p.id, 1)
      and public.user_has_activity_in_week(p.id, 2)
      and public.user_has_activity_in_week(p.id, 3)
      and public.user_has_activity_in_week(p.id, 4)
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

revoke all on function public.run_weekly_draw(integer) from public, anon, authenticated;
revoke all on function public.run_grand_prize_draw() from public, anon, authenticated;
grant execute on function public.run_weekly_draw(integer) to authenticated;
grant execute on function public.run_grand_prize_draw() to authenticated;

commit;
