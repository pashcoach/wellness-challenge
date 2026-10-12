-- Rollback-only production verification for weekly draws with winners from
-- different departments. Run after loading
-- migration-weekly-draw-different-departments.sql (without its begin/commit
-- lines) in the same transaction. The final TESTRESULT exception rolls back
-- every change, including the simulated Week 1 redraws.

do $test$
declare
  v_admin uuid;
  v_round integer;
  v_rows integer;
  v_departments integer;
  v_only_department text;
  v_denied boolean;
  v_message text;
  v_week2_runs integer;
begin
  select p.id into v_admin from public.profiles p where p.is_admin order by p.id limit 1;
  if v_admin is null then raise exception 'Expected an administrator profile'; end if;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  select count(*) into v_week2_runs from public.draw_runs where draw_key in ('week2', 'week3', 'week4');

  for v_round in 1..25 loop
    delete from public.draw_results where draw_key = 'week1';
    delete from public.draw_runs where draw_key = 'week1';

    select count(*)::integer into v_rows from public.run_weekly_draw(1);
    if v_rows <> 2 then raise exception 'Round % returned % winners', v_round, v_rows; end if;

    select count(*)::integer, count(distinct private.normalize_department(p.business_unit))::integer
    into v_rows, v_departments
    from public.draw_results d join public.profiles p on p.id = d.user_id
    where d.draw_key = 'week1';
    if v_rows <> 2 or v_departments <> 2 then
      raise exception 'Round % did not record 2 winners from different departments', v_round;
    end if;

    if exists (
      select 1 from public.draw_results d join public.profiles p on p.id = d.user_id
      where d.draw_key = 'week1'
        and (public.user_week_points(p.id, 1) < 140
          or not public.user_has_activity_in_week(p.id, 1)
          or p.exclude_from_prizes
          or private.normalize_department(p.business_unit) = ''
          or exists (select 1 from public.draw_results x where x.user_id = p.id and x.draw_key <> 'week1'))
    ) then
      raise exception 'Round % selected an ineligible winner', v_round;
    end if;
    if (select count(*) from public.draw_runs where draw_key = 'week1') <> 1 then
      raise exception 'Round % did not record exactly one run', v_round;
    end if;
  end loop;

  v_denied := false;
  begin
    perform public.run_weekly_draw(1);
  exception when others then
    v_denied := sqlerrm like '%already been run%';
  end;
  if not v_denied then raise exception 'Repeat weekly draw was not refused'; end if;

  -- Leave only one eligible department and confirm the draw fails closed
  -- before it records a run.
  delete from public.draw_results where draw_key = 'week1';
  delete from public.draw_runs where draw_key = 'week1';
  select private.normalize_department(p.business_unit) into v_only_department
  from public.profiles p
  where public.user_week_points(p.id, 1) >= 140
    and public.user_has_activity_in_week(p.id, 1)
    and not p.exclude_from_prizes
    and private.normalize_department(p.business_unit) <> ''
  group by 1
  having count(*) >= 2
  order by 1
  limit 1;
  update public.profiles p set exclude_from_prizes = true
  where public.user_week_points(p.id, 1) >= 140
    and public.user_has_activity_in_week(p.id, 1)
    and not p.exclude_from_prizes
    and private.normalize_department(p.business_unit) <> v_only_department;

  v_denied := false;
  begin
    perform public.run_weekly_draw(1);
  exception when others then
    v_message := sqlerrm;
    v_denied := v_message like '%at least 2 departments%';
  end;
  if not v_denied then raise exception 'Single-department pool was not refused: %', coalesce(v_message, 'no error'); end if;
  if exists (select 1 from public.draw_runs where draw_key = 'week1') then
    raise exception 'Refused draw recorded a run';
  end if;
  if (select count(*) from public.draw_runs where draw_key in ('week2', 'week3', 'week4')) <> v_week2_runs then
    raise exception 'Later weekly draw history changed';
  end if;

  raise exception 'TESTRESULT PASS weekly draw: 25 simulated draws all picked eligible winners from 2 departments, repeat refused, single-department pool refused before recording';
end $test$;
