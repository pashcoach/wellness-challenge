-- Rollback-only production verification for the Week 1 team cutoff and the
-- one-shot two-member cleanup. Run after loading migration-team-minimum.sql in
-- the same transaction. The final TESTRESULT exception rolls back all changes.

do $test$
declare
  v_user uuid;
  v_expected_teams integer;
  v_expected_people integer;
  v_activities bigint;
  v_checkins bigint;
  v_locks bigint;
  v_result record;
  v_early_denied boolean := false;
  v_repeat_denied boolean := false;
begin
  select p.id into v_user
  from public.profiles p
  where p.team_id is null
    and exists (select 1 from public.participant_team_locks l where l.user_id=p.id)
  order by p.id
  limit 1;
  if v_user is null then raise exception 'Expected a locked solo participant'; end if;

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  if not public.can_current_user_create_team() or not public.can_current_user_join_team() then
    raise exception 'Week 1 solo participant should be eligible';
  end if;
  if public.solo_week_one_join_open('2026-10-04 23:59:59-06'::timestamptz) then
    raise exception 'Team setup opened early';
  end if;
  if not public.solo_week_one_join_open('2026-10-11 23:59:59-06'::timestamptz) then
    raise exception 'Team setup closed before the deadline';
  end if;
  if public.solo_week_one_join_open('2026-10-12 00:00:00-06'::timestamptz) then
    raise exception 'Team setup stayed open after the deadline';
  end if;

  select count(*)::integer into v_expected_teams from (
    select t.id
    from public.teams t
    left join public.profiles p on p.team_id=t.id
    group by t.id
    having count(p.id)<2
  ) q;
  select count(*)::integer into v_expected_people
  from public.profiles p
  where p.team_id in (
    select t.id
    from public.teams t
    left join public.profiles m on m.team_id=t.id
    group by t.id
    having count(m.id)<2
  );
  select count(*) into v_activities from public.activity_entries;
  select count(*) into v_checkins from public.wellness_checkins;
  select count(*) into v_locks from public.participant_team_locks;

  begin
    perform public.admin_enforce_team_minimum('2026-10-11 23:59:59-06'::timestamptz);
  exception when others then
    v_early_denied:=true;
  end;
  if not v_early_denied then raise exception 'Cleanup ran before the deadline'; end if;

  select * into v_result
  from public.admin_enforce_team_minimum('2026-10-12 00:05:00-06'::timestamptz);
  if v_result.deleted_teams<>v_expected_teams
     or v_result.soloed_participants<>v_expected_people then
    raise exception 'Cleanup counts did not match';
  end if;
  if exists(
    select 1
    from public.teams t
    left join public.profiles p on p.team_id=t.id
    group by t.id
    having count(p.id)<2
  ) then
    raise exception 'An underfilled team remained';
  end if;
  if (select count(*) from public.activity_entries)<>v_activities
     or (select count(*) from public.wellness_checkins)<>v_checkins
     or (select count(*) from public.participant_team_locks)<>v_locks then
    raise exception 'Participant records or locks changed';
  end if;
  if not exists(
    select 1 from public.team_minimum_cleanup_runs where run_key='2026-10-12'
  ) then
    raise exception 'Cleanup audit record missing';
  end if;

  begin
    perform public.admin_enforce_team_minimum('2026-10-12 00:06:00-06'::timestamptz);
  exception when others then
    v_repeat_denied:=true;
  end;
  if not v_repeat_denied then raise exception 'Cleanup was not one-shot'; end if;

  raise exception 'TESTRESULT PASS team minimum cleanup, cutoff, records, locks, and one-shot guard';
end $test$;
