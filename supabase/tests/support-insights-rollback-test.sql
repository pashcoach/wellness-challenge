-- Rollback-only production verification for support insights.
-- The runner injects the migration body and private import key in memory.

begin;

__MIGRATION__

do $$
declare
  v_result jsonb;
  v_event_count integer;
  v_admin uuid;
  v_report_count integer;
begin
  begin
    perform public.import_support_insight_events('wrong-key', '[]'::jsonb);
    raise exception 'wrong import key unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  v_result := public.import_support_insight_events(
    '__IMPORT_KEY__',
    jsonb_build_array(jsonb_build_object(
      'source_id', 'rollback_test_thread',
      'first_seen', '2026-10-08T10:00:00Z',
      'last_seen', '2026-10-08T11:00:00Z',
      'contact_email', 'rollback-test-not-a-user@example.invalid',
      'contact_name', 'Rollback Test Not A User',
      'category', 'team_membership',
      'topic', 'team_join',
      'matched_rule', 'team code',
      'status', 'responded',
      'response_sent', true,
      'message_count', 2
    ))
  );

  if (v_result->>'inserted')::integer <> 1 then
    raise exception 'test Gmail insight was not inserted exactly once';
  end if;

  select count(*) into v_event_count
  from private.support_insight_events e
  where e.source_id = 'rollback_test_thread'
    and e.account_id is null
    and e.linked_dashboard_request_id is null;
  if v_event_count <> 1 then
    raise exception 'privacy-minimized test event is invalid';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'private'
      and table_name = 'support_insight_events'
      and column_name in ('sender_email', 'body', 'subject', 'participant_name')
  ) then
    raise exception 'support insight storage contains a prohibited PII/content column';
  end if;

  if has_table_privilege('anon', 'private.support_insight_events', 'SELECT')
     or has_table_privilege('authenticated', 'private.support_insight_events', 'SELECT') then
    raise exception 'raw support insight events are directly readable';
  end if;

  select u.id into v_admin
  from auth.users u
  where u.raw_app_meta_data ->> 'is_admin' = 'true'
  order by u.created_at
  limit 1;
  if v_admin is null then
    raise exception 'no trusted administrator exists for report verification';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  select count(*) into v_report_count
  from public.support_improvement_report(
    '2026-10-01T00:00:00-06:00'::timestamptz,
    '2026-11-01T00:00:00-06:00'::timestamptz
  );
  if v_report_count < 1 then
    raise exception 'admin report returned no rows';
  end if;

  raise exception 'TESTRESULT PASS support insights import, privacy, admin report, and rollback';
end;
$$;

rollback;
