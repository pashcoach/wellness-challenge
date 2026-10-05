do $$
declare
  v_user uuid;
  v_admin uuid;
  v_date date := public.challenge_today();
  v_a uuid; v_b uuid; v_c uuid;
  v_failed boolean;
  v_msg text;
  v_row record;
  v_res jsonb;
  v_reviews integer;
begin
  select u.id into v_admin from auth.users u where u.raw_app_meta_data ->> 'is_admin' = 'true' limit 1;
  select p.id into v_user from public.profiles p
  where p.is_admin = false
    and not exists (select 1 from public.activity_entries a where a.user_id = p.id and a.entry_date = v_date)
  order by p.created_at limit 1;
  if v_admin is null or v_user is null then raise exception 'TESTSETUP missing admin or participant'; end if;

  insert into public.activity_entries (user_id, activity, minutes, points, entry_date, week)
  values (v_user, 'Walking', 200, 200, v_date, 1) returning id into v_a;
  insert into public.activity_entries (user_id, activity, minutes, points, entry_date, week)
  values (v_user, 'Yoga', 40, 40, v_date, 1) returning id into v_b;

  -- 1. Over the limit on insert is rejected with the remaining minutes.
  v_failed := false;
  begin
    insert into public.activity_entries (user_id, activity, minutes, points, entry_date, week)
    values (v_user, 'Running', 1, 1, v_date, 1);
  exception when check_violation then v_failed := true; v_msg := sqlerrm;
  end;
  if not v_failed or v_msg not like 'Daily activity limit reached: 0 minutes left for %' then
    raise exception 'TESTFAIL insert over limit: %', v_msg;
  end if;

  -- 2. Increasing an entry past the limit is rejected; reducing is allowed.
  v_failed := false;
  begin update public.activity_entries set minutes = 50 where id = v_b;
  exception when check_violation then v_failed := true; end;
  if not v_failed then raise exception 'TESTFAIL increase past limit allowed'; end if;
  update public.activity_entries set minutes = 30 where id = v_b;
  if (select points from public.activity_entries where id = v_b) <> 30 then raise exception 'TESTFAIL points not recomputed'; end if;

  -- 3. Moving an entry onto a full day is rejected.
  insert into public.activity_entries (user_id, activity, minutes, points, entry_date, week)
  values (v_user, 'Cycling', 10, 10, v_date, 1);
  if (select sum(minutes) from public.activity_entries where user_id = v_user and entry_date = v_date) <> 240 then
    raise exception 'TESTFAIL expected exactly 240';
  end if;

  -- 4. A legacy over-limit entry can be reduced but not increased.
  alter table public.activity_entries disable trigger enforce_daily_activity_limit;
  insert into public.activity_entries (user_id, activity, minutes, points, entry_date, week)
  values (v_user, 'Hiking', 600, 600, v_date, 1) returning id into v_c;
  alter table public.activity_entries enable trigger enforce_daily_activity_limit;
  update public.activity_entries set minutes = 500 where id = v_c;
  v_failed := false;
  begin update public.activity_entries set minutes = 501 where id = v_c;
  exception when check_violation then v_failed := true; end;
  if not v_failed then raise exception 'TESTFAIL legacy increase allowed'; end if;

  -- 5. Non-admins cannot use the audit RPCs.
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  v_failed := false;
  begin perform * from public.admin_activity_audit_queue();
  exception when insufficient_privilege then v_failed := true; end;
  if not v_failed then raise exception 'TESTFAIL participant read audit queue'; end if;
  v_failed := false;
  begin perform public.admin_reduce_activity_entry(v_c, 10, null);
  exception when insufficient_privilege then v_failed := true; end;
  if not v_failed then raise exception 'TESTFAIL participant reduced entry'; end if;

  -- 6. Admin queue, approve, and reduce.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select * into v_row from public.admin_activity_audit_queue() q where q.user_id = v_user and q.entry_date = v_date;
  if v_row is null or v_row.day_minutes <> 740 or v_row.max_entry_minutes <> 500 or v_row.reviewed then
    raise exception 'TESTFAIL queue row %', row_to_json(v_row);
  end if;
  if v_row.email is null or v_row.first_name is null or jsonb_array_length(v_row.entries) <> 4 then
    raise exception 'TESTFAIL queue details';
  end if;

  v_res := public.admin_mark_activity_day_reviewed(v_user, v_date, 'confirmed hike');
  select * into v_row from public.admin_activity_audit_queue() q where q.user_id = v_user and q.entry_date = v_date;
  if not v_row.reviewed or v_row.last_review ->> 'decision' <> 'approved' then raise exception 'TESTFAIL approve'; end if;

  v_failed := false;
  begin perform public.admin_reduce_activity_entry(v_c, 500, null);
  exception when check_violation then v_failed := true; end;
  if not v_failed then raise exception 'TESTFAIL reduce to same allowed'; end if;

  v_res := public.admin_reduce_activity_entry(v_c, 100, 'confirmed 100 min');
  if (v_res ->> 'minutes_after')::int <> 100 or (v_res ->> 'day_minutes')::int <> 340 then
    raise exception 'TESTFAIL reduce result %', v_res;
  end if;
  if (select points from public.activity_entries where id = v_c) <> 100 then raise exception 'TESTFAIL reduced points'; end if;
  select * into v_row from public.admin_activity_audit_queue() q where q.user_id = v_user and q.entry_date = v_date;
  if not v_row.reviewed or v_row.day_minutes <> 340 then raise exception 'TESTFAIL post-reduce queue'; end if;
  select count(*) into v_reviews from public.activity_audit_reviews where user_id = v_user;
  if v_reviews <> 2 then raise exception 'TESTFAIL review log count %', v_reviews; end if;

  -- 7. Privileges.
  if has_table_privilege('authenticated', 'public.activity_audit_reviews', 'select')
     or has_table_privilege('anon', 'public.activity_audit_reviews', 'select')
     or has_function_privilege('anon', 'public.admin_activity_audit_queue()', 'execute')
     or has_function_privilege('authenticated', 'public.enforce_daily_activity_limit()', 'execute')
     or not has_function_privilege('authenticated', 'public.admin_reduce_activity_entry(uuid, integer, text)', 'execute') then
    raise exception 'TESTFAIL privileges';
  end if;

  raise exception 'TESTRESULT all activity-audit checks passed';
end;
$$;
