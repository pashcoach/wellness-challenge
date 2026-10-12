-- Rollback-only production verification for the Week 1 department correction.
-- Run after loading migration-week1-department-correction.sql (without its
-- begin/commit lines) in the same transaction. The final TESTRESULT exception
-- rolls back all changes.

do $test$
declare
  v_original uuid[];
  v_after uuid[];
  v_kept uuid;
  v_replacement uuid;
  v_shared text;
  v_rows integer;
  v_repeat_denied boolean := false;
  v_activities bigint;
  v_checkins bigint;
begin
  select array_agg(d.user_id order by d.user_id) into v_original
  from public.draw_results d where d.draw_key = 'week1';
  if coalesce(cardinality(v_original), 0) <> 2 then
    raise exception 'Expected 2 recorded Week 1 winners';
  end if;
  select count(distinct private.normalize_department(p.business_unit)), min(private.normalize_department(p.business_unit))
  into v_rows, v_shared
  from public.profiles p where p.id = any(v_original);
  if v_rows <> 1 then raise exception 'Expected a shared-department conflict'; end if;
  if private.normalize_department('People & Culture') <> private.normalize_department(' People and  Culture ') then
    raise exception 'Department normalization failed';
  end if;

  select count(*) into v_activities from public.activity_entries;
  select count(*) into v_checkins from public.wellness_checkins;

  select count(*)::integer into v_rows
  from public.admin_correct_weekly_draw_department_conflict(1);
  if v_rows <> 2 then raise exception 'Correction did not return 2 winners'; end if;

  select array_agg(d.user_id order by d.user_id) into v_after
  from public.draw_results d where d.draw_key = 'week1';
  if cardinality(v_after) <> 2 then raise exception 'Week 1 no longer has 2 winners'; end if;
  if (select count(*) from unnest(v_after) u where u = any(v_original)) <> 1 then
    raise exception 'Exactly one original winner should remain';
  end if;

  select c.kept_user_id, c.replacement_user_id into v_kept, v_replacement
  from private.prize_draw_department_corrections c where c.draw_key = 'week1';
  if v_kept is null or not (v_kept = any(v_original)) or not (v_kept = any(v_after)) then
    raise exception 'Kept winner audit is wrong';
  end if;
  if v_replacement = any(v_original) or not (v_replacement = any(v_after)) then
    raise exception 'Replacement audit is wrong';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_replacement
      and public.user_week_points(p.id, 1) >= 140
      and public.user_has_activity_in_week(p.id, 1)
      and not p.exclude_from_prizes
      and private.normalize_department(p.business_unit) <> v_shared
  ) then
    raise exception 'Replacement is not eligible or shares the department';
  end if;
  if (select count(*) from public.draw_results d where d.user_id = v_replacement) <> 1 then
    raise exception 'Replacement has another prize result';
  end if;
  if (select count(distinct private.normalize_department(p.business_unit))
      from public.draw_results d join public.profiles p on p.id = d.user_id
      where d.draw_key = 'week1') <> 2 then
    raise exception 'Final winners share a department';
  end if;
  if (select count(*) from public.draw_runs where draw_key = 'week1') <> 1 then
    raise exception 'Week 1 run ledger changed';
  end if;
  if (select count(*) from public.activity_entries) <> v_activities
     or (select count(*) from public.wellness_checkins) <> v_checkins then
    raise exception 'Participant records changed';
  end if;

  begin
    perform public.admin_correct_weekly_draw_department_conflict(1);
  exception when others then
    v_repeat_denied := true;
  end;
  if not v_repeat_denied then raise exception 'Correction was not one-shot'; end if;

  raise exception 'TESTRESULT PASS week1 department correction kept one original, replaced one eligible cross-department winner, audited once';
end $test$;
