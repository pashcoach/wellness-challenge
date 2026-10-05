do $$
declare
  v_user uuid;
  v_admin uuid;
  v_date date := public.challenge_today();
  v_a uuid; v_b uuid;
  v_failed boolean;
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

  -- 1. Totals above 240 minutes are allowed and normalized to points.
  insert into public.activity_entries (user_id, activity, minutes, points, entry_date, week)
  values (v_user, 'Walking', 600, 1, v_date, 1) returning id into v_a;
  insert into public.activity_entries (user_id, activity, minutes, points, entry_date, week)
  values (v_user, 'Yoga', 50, 1, v_date, 1) returning id into v_b;
  if (select sum(minutes) from public.activity_entries where user_id = v_user and entry_date = v_date) <> 650
     or (select sum(points) from public.activity_entries where user_id = v_user and entry_date = v_date) <> 650 then
    raise exception 'TESTFAIL totals above review threshold were not accepted';
  end if;

  -- 2. A participant can edit an entry upward or downward without a daily cap.
  update public.activity_entries set minutes = 650 where id = v_a;
  update public.activity_entries set minutes = 600 where id = v_a;
  if (select points from public.activity_entries where id = v_a) <> 600 then raise exception 'TESTFAIL points not recomputed'; end if;

  -- 3. Non-admins cannot use the audit RPCs.
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  v_failed := false;
  begin perform * from public.admin_activity_audit_queue();
  exception when insufficient_privilege then v_failed := true; end;
  if not v_failed then raise exception 'TESTFAIL participant read audit queue'; end if;
  v_failed := false;
  begin perform public.admin_reduce_activity_entry(v_a, 10, null);
  exception when insufficient_privilege then v_failed := true; end;
  if not v_failed then raise exception 'TESTFAIL participant reduced entry'; end if;

  -- 4. Admin queue, approve, and reduce remain available.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select * into v_row from public.admin_activity_audit_queue() q where q.user_id = v_user and q.entry_date = v_date;
  if v_row is null or v_row.day_minutes <> 650 or v_row.max_entry_minutes <> 600 or v_row.reviewed then
    raise exception 'TESTFAIL queue row %', row_to_json(v_row);
  end if;
  if v_row.email is null or v_row.first_name is null or jsonb_array_length(v_row.entries) <> 2 then
    raise exception 'TESTFAIL queue details';
  end if;

  v_res := public.admin_mark_activity_day_reviewed(v_user, v_date, 'confirmed');
  select * into v_row from public.admin_activity_audit_queue() q where q.user_id = v_user and q.entry_date = v_date;
  if not v_row.reviewed or v_row.last_review ->> 'decision' <> 'approved' then raise exception 'TESTFAIL approve'; end if;

  v_failed := false;
  begin perform public.admin_reduce_activity_entry(v_a, 600, null);
  exception when check_violation then v_failed := true; end;
  if not v_failed then raise exception 'TESTFAIL reduce to same allowed'; end if;

  v_res := public.admin_reduce_activity_entry(v_a, 100, 'confirmed 100 min');
  if (v_res ->> 'minutes_after')::int <> 100 or (v_res ->> 'day_minutes')::int <> 150 then
    raise exception 'TESTFAIL reduce result %', v_res;
  end if;
  if (select points from public.activity_entries where id = v_a) <> 100 then raise exception 'TESTFAIL reduced points'; end if;
  select count(*) into v_reviews from public.activity_audit_reviews where user_id = v_user;
  if v_reviews <> 2 then raise exception 'TESTFAIL review log count %', v_reviews; end if;

  -- 5. The hard-limit trigger/function are gone and audit data remains private.
  if exists (select 1 from pg_trigger where tgname = 'enforce_daily_activity_limit' and not tgisinternal)
     or to_regprocedure('public.enforce_daily_activity_limit()') is not null
     or has_table_privilege('authenticated', 'public.activity_audit_reviews', 'select')
     or has_table_privilege('anon', 'public.activity_audit_reviews', 'select')
     or has_function_privilege('anon', 'public.admin_activity_audit_queue()', 'execute')
     or not has_function_privilege('authenticated', 'public.admin_reduce_activity_entry(uuid, integer, text)', 'execute') then
    raise exception 'TESTFAIL limit removal or audit privileges';
  end if;

  raise exception 'TESTRESULT all no-limit activity-audit checks passed';
end;
$$;
