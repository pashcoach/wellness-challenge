-- Week 3 only: first winner from eligible CRC participants in the top three
-- normalized business units by distinct Week 3 active CRC people (activity OR
-- checkin). Competition rank <= 3 includes cutoff ties, not dense ranks.
-- Both organizer flags exclude ranking; first slot also excludes standings.
-- Second winner uses the unchanged full pool in a different normalized unit.
-- CRC is a location flag, never a department. No draws or history edits here.
-- Apply AFTER migration-weekly-draw-different-departments.sql.
begin;

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
  v_top_crc_units text[];
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

  -- BEGIN WEEK3 CRC RANKING
  if p_week = 3 then
    with active_crc_units as (
      select private.normalize_department(p.business_unit) as unit,
        count(distinct p.id) as active_participants
      from public.profiles p
      where p.located_at_crc is true
        and not p.exclude_from_standings
        and not p.exclude_from_prizes
        and private.normalize_department(p.business_unit) <> ''
        and (
          exists (select 1 from public.activity_entries a where a.user_id = p.id and a.week = 3)
          or exists (select 1 from public.wellness_checkins c where c.user_id = p.id and c.week = 3)
        )
      group by private.normalize_department(p.business_unit)
    ), ranked_crc_units as (
      select unit, rank() over (order by active_participants desc) as participant_rank
      from active_crc_units
    )
    select array_agg(unit) into v_top_crc_units
    from ranked_crc_units where participant_rank <= 3;
  end if;
  -- END WEEK3 CRC RANKING

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
    and (p_week <> 3 or (p.located_at_crc is true
      and not p.exclude_from_standings
      and private.normalize_department(p.business_unit) = any(v_top_crc_units)))
  order by random()
  limit 1;

  if p_week = 3 and v_first is null then
    raise exception 'Week 3 needs an eligible CRC participant from the top three active CRC business units with 140+ points and a logged wellness activity.';
  end if;

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
