-- Privacy-minimized support insight ingestion and unified admin report.
-- Gmail sender addresses are used transiently to match an existing account and
-- are never stored. Raw subjects, bodies, headers, names and addresses are not
-- accepted by the storage table or returned by the report.

begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.support_insight_events (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'gmail' check (source = 'gmail'),
  source_id text not null,
  account_id uuid references public.profiles(id) on delete set null,
  category text not null check (category in (
    'privacy_security', 'account_access', 'team_membership', 'activity_points',
    'wellness_checkin', 'bug_performance', 'usability_content',
    'feature_request', 'email_delivery', 'other'
  )),
  topic text not null check (char_length(topic) between 1 and 80),
  matched_rule text not null check (char_length(matched_rule) between 1 and 120),
  rule_version integer not null default 1 check (rule_version > 0),
  first_seen timestamptz not null,
  last_seen timestamptz not null,
  status text not null check (status in ('open', 'responded')),
  response_sent boolean not null default false,
  message_count integer not null default 1 check (message_count > 0),
  linked_dashboard_request_id uuid references public.survey_responses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id),
  check (last_seen >= first_seen)
);

create index if not exists support_insight_events_linked_request_idx
  on private.support_insight_events (linked_dashboard_request_id)
  where linked_dashboard_request_id is not null;
create index if not exists support_insight_events_category_seen_idx
  on private.support_insight_events (category, last_seen desc);

create table if not exists private.support_insight_import_config (
  singleton boolean primary key default true check (singleton),
  import_key_hash bytea not null,
  updated_at timestamptz not null default now()
);

insert into private.support_insight_import_config (singleton, import_key_hash)
values (true, decode('0d9e99b009a9b18daa107a647b98fcae816150836db685ac4575e92b8c0e936d', 'hex'))
on conflict (singleton) do update
set import_key_hash = excluded.import_key_hash,
    updated_at = now();

revoke all on table private.support_insight_events from public, anon, authenticated;
revoke all on table private.support_insight_import_config from public, anon, authenticated;

-- Keep every support surface on the protected Auth app-metadata admin predicate.
drop policy if exists "survey_read_own" on public.survey_responses;
drop policy if exists "survey_read_own_or_admin" on public.survey_responses;
create policy "survey_read_own_or_admin"
on public.survey_responses for select to authenticated
using (user_id = auth.uid() or public.is_current_user_admin());

drop policy if exists "survey_update_admin" on public.survey_responses;
create policy "survey_update_admin"
on public.survey_responses for update to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists "support_replies_read_own_or_admin" on public.support_replies;
create policy "support_replies_read_own_or_admin"
on public.support_replies for select to authenticated
using (
  public.is_current_user_admin()
  or exists (
    select 1 from public.survey_responses r
    where r.id = support_replies.request_id and r.user_id = auth.uid()
  )
);

create or replace function private.classify_support_insight(
  p_text text,
  p_submitted_category text default null
)
returns table (category text, topic text)
language sql
immutable
set search_path = ''
as $$
  with normalized as (
    select lower(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g')) as value
  )
  select
    case
      when value ~ '(password reset|reset code|forgot password|reset email)' then 'account_access'
      when value ~ '(permission|do not have permission|can''t check in|cant check in|cannot check in)' then 'wellness_checkin'
      when value ~ '(don''t know who|do not know who|nor do we know who|didn''t know who|didn''t know (he|she|they) had joined|had joined our team|unknown member|unknown teammate)' then 'team_membership'
      when value ~ '(wrong team|switch team|leave team|remove me from|remove himself|remove herself|accidentally joined|removed from (this|the|my|our) team|remove (him|her|them) from)' then 'team_membership'
      when value ~ '(remove my|delete my|wrong entry|mistake entry|adjust my points|incorrect activity)' then 'activity_points'
      when value ~ '(team code|join my team|join the team|invite teammate|invite a teammate|teammate join)' then 'team_membership'
      when value ~ '(check in|check-in|weekly wellness)' then 'wellness_checkin'
      when value ~ '(points|activity log|log activity|logged activity|minutes)' then 'activity_points'
      when value ~ '(sign up|signup|sign-up|registration|register for|still join the (wellness )?challenge)' then 'account_access'
      when value ~ '(sign in|signin|log in|login|account access)' then 'account_access'
      when value ~ '(not receiving|didn''t receive|did not receive|email never arrived)' then 'email_delivery'
      when value ~ '(error|not working|doesn''t work|does not work|blank screen|stuck|crash)' then 'bug_performance'
      when value ~ '(it would be helpful|feature request|please add|could you add|suggestion)'
        or p_submitted_category = 'idea' then 'feature_request'
      when value ~ '(how do i|how can i|where do i|can''t find|cant find)' then 'usability_content'
      when value ~ '(privacy|security|personal information|who can see)' then 'privacy_security'
      else 'other'
    end,
    case
      when value ~ '(password reset|reset code|forgot password|reset email)' then 'password_reset'
      when value ~ '(permission|do not have permission|can''t check in|cant check in|cannot check in)' then 'checkin_permission'
      when value ~ '(don''t know who|do not know who|nor do we know who|didn''t know who|didn''t know (he|she|they) had joined|had joined our team|unknown member|unknown teammate)' then 'team_roster_question'
      when value ~ '(wrong team|switch team|leave team|remove me from|remove himself|remove herself|accidentally joined|removed from (this|the|my|our) team|remove (him|her|them) from)' then 'team_change'
      when value ~ '(remove my|delete my|wrong entry|mistake entry|adjust my points|incorrect activity)' then 'activity_correction'
      when value ~ '(team code|join my team|join the team|invite teammate|invite a teammate|teammate join)' then 'team_join'
      when value ~ '(check in|check-in|weekly wellness)' then 'checkin_help'
      when value ~ '(points|activity log|log activity|logged activity|minutes)' then 'points_question'
      when value ~ '(sign up|signup|sign-up|registration|register for|still join the (wellness )?challenge)' then 'registration'
      when value ~ '(sign in|signin|log in|login|account access)' then 'sign_in'
      when value ~ '(not receiving|didn''t receive|did not receive|email never arrived)' then 'email_delivery'
      when value ~ '(error|not working|doesn''t work|does not work|blank screen|stuck|crash)' then 'app_error'
      when value ~ '(it would be helpful|feature request|please add|could you add|suggestion)'
        or p_submitted_category = 'idea' then 'feature_request'
      when value ~ '(how do i|how can i|where do i|can''t find|cant find)' then 'how_to'
      when value ~ '(privacy|security|personal information|who can see)' then 'privacy_security'
      else 'other'
    end
  from normalized;
$$;

create or replace function public.import_support_insight_events(
  p_import_key text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_account_id uuid;
  v_linked_request uuid;
  v_first_seen timestamptz;
  v_last_seen timestamptz;
  v_existing boolean;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_linked integer := 0;
begin
  if p_import_key is null or not exists (
    select 1
    from private.support_insight_import_config c
    where c.singleton
      and c.import_key_hash = extensions.digest(p_import_key, 'sha256')
  ) then
    raise exception using errcode = '42501', message = 'Invalid support insight import key.';
  end if;

  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception using errcode = '22023', message = 'Support insight import must be an array of at most 500 rows.';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    if coalesce(v_row->>'source_id', '') !~ '^[A-Za-z0-9_-]{1,128}$'
       or coalesce(v_row->>'category', '') not in (
         'privacy_security', 'account_access', 'team_membership', 'activity_points',
         'wellness_checkin', 'bug_performance', 'usability_content',
         'feature_request', 'email_delivery', 'other'
       )
       or coalesce(v_row->>'topic', '') !~ '^[a-z0-9_]{1,80}$'
       or coalesce(v_row->>'matched_rule', '') = ''
       or char_length(v_row->>'matched_rule') > 120
       or coalesce(v_row->>'status', '') not in ('open', 'responded')
       or coalesce((v_row->>'message_count')::integer, 0) < 1 then
      raise exception using errcode = '22023', message = 'Invalid support insight row.';
    end if;

    v_first_seen := (v_row->>'first_seen')::timestamptz;
    v_last_seen := (v_row->>'last_seen')::timestamptz;
    if v_last_seen < v_first_seen then
      raise exception using errcode = '22023', message = 'Support insight dates are invalid.';
    end if;

    select u.id into v_account_id
    from auth.users u
    where lower(u.email) = lower(coalesce(v_row->>'contact_email', v_row->>'sender_email'))
    order by u.created_at
    limit 1;

    -- A participant may contact support from a different mailbox. Fall back to
    -- an exact, unique profile-name match from Gmail's display name. The name is
    -- used only inside this transaction and is never stored or returned.
    if v_account_id is null
       and btrim(coalesce(coalesce(v_row->>'contact_name', v_row->>'sender_name'), '')) <> ''
       and (
         select count(*)
         from public.profiles p
         where lower(regexp_replace(btrim(p.full_name), '\s+', ' ', 'g')) =
               lower(regexp_replace(btrim(coalesce(v_row->>'contact_name', v_row->>'sender_name')), '\s+', ' ', 'g'))
       ) = 1 then
      select p.id into v_account_id
      from public.profiles p
      where lower(regexp_replace(btrim(p.full_name), '\s+', ' ', 'g')) =
            lower(regexp_replace(btrim(coalesce(v_row->>'contact_name', v_row->>'sender_name')), '\s+', ' ', 'g'));
    end if;

    v_linked_request := null;
    if v_account_id is not null then
      select s.id into v_linked_request
      from public.survey_responses s
      cross join lateral private.classify_support_insight(s.feedback, s.category) c
      where s.user_id = v_account_id
        and c.topic = v_row->>'topic'
        and abs(extract(epoch from (s.created_at - v_first_seen))) <= 1209600
      order by abs(extract(epoch from (s.created_at - v_first_seen))), s.created_at
      limit 1;
    end if;

    select exists (
      select 1 from private.support_insight_events e
      where e.source = 'gmail' and e.source_id = v_row->>'source_id'
    ) into v_existing;

    insert into private.support_insight_events (
      source, source_id, account_id, category, topic, matched_rule,
      rule_version, first_seen, last_seen, status, response_sent,
      message_count, linked_dashboard_request_id, updated_at
    ) values (
      'gmail', v_row->>'source_id', v_account_id, v_row->>'category',
      v_row->>'topic', v_row->>'matched_rule', 2, v_first_seen, v_last_seen,
      v_row->>'status', coalesce((v_row->>'response_sent')::boolean, false),
      (v_row->>'message_count')::integer, v_linked_request, now()
    )
    on conflict (source, source_id) do update
    set account_id = excluded.account_id,
        category = excluded.category,
        topic = excluded.topic,
        matched_rule = excluded.matched_rule,
        rule_version = excluded.rule_version,
        first_seen = least(private.support_insight_events.first_seen, excluded.first_seen),
        last_seen = greatest(private.support_insight_events.last_seen, excluded.last_seen),
        status = excluded.status,
        response_sent = excluded.response_sent,
        message_count = excluded.message_count,
        linked_dashboard_request_id = excluded.linked_dashboard_request_id,
        updated_at = now();

    if v_existing then v_updated := v_updated + 1; else v_inserted := v_inserted + 1; end if;
    if v_linked_request is not null then v_linked := v_linked + 1; end if;
    v_account_id := null;
  end loop;

  return jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'linked_to_dashboard', v_linked
  );
end;
$$;

revoke all on function public.import_support_insight_events(text, jsonb) from public, anon, authenticated;
grant execute on function public.import_support_insight_events(text, jsonb) to anon;

create or replace function public.support_improvement_report(
  p_from timestamptz default '2026-10-01 00:00:00-06'::timestamptz,
  p_to timestamptz default now()
)
returns table (
  issue_key text,
  source text,
  category text,
  topic text,
  first_seen timestamptz,
  last_seen timestamptz,
  status text,
  response_sent boolean,
  response_channel text,
  occurrence_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_current_user_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required.';
  end if;
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > interval '366 days' then
    raise exception using errcode = '22023', message = 'Invalid support report date range.';
  end if;

  return query
  with dashboard as (
    select
      s.id,
      c.category,
      c.topic,
      s.created_at,
      s.updated_at,
      s.status,
      (s.resolution_email_sent_at is not null or exists (
        select 1 from public.support_replies r
        where r.request_id = s.id and r.email_sent_at is not null
      )) as dashboard_response
    from public.survey_responses s
    cross join lateral private.classify_support_insight(s.feedback, s.category) c
    where s.created_at between p_from and p_to
  ),
  linked_gmail as (
    select
      e.linked_dashboard_request_id as request_id,
      min(e.first_seen) as first_seen,
      max(e.last_seen) as last_seen,
      bool_or(e.response_sent) as gmail_response,
      count(*)::integer as gmail_occurrences
    from private.support_insight_events e
    where e.linked_dashboard_request_id is not null
      and e.first_seen between p_from and p_to
    group by e.linked_dashboard_request_id
  ),
  dashboard_rows as (
    select
      'dashboard:' || d.id::text as issue_key,
      case when g.request_id is not null then 'both' else 'dashboard' end as source,
      d.category,
      d.topic,
      least(d.created_at, coalesce(g.first_seen, d.created_at)) as first_seen,
      greatest(d.updated_at, coalesce(g.last_seen, d.updated_at)) as last_seen,
      case d.status when 'new' then 'open' else d.status end as status,
      (d.dashboard_response or coalesce(g.gmail_response, false)) as response_sent,
      case
        when d.dashboard_response and coalesce(g.gmail_response, false) then 'both'
        when d.dashboard_response then 'dashboard'
        when coalesce(g.gmail_response, false) then 'gmail'
        else 'none'
      end as response_channel,
      (1 + coalesce(g.gmail_occurrences, 0))::integer as occurrence_count
    from dashboard d
    left join linked_gmail g on g.request_id = d.id
  ),
  gmail_rows as (
    select
      'gmail:' || e.source_id as issue_key,
      'gmail'::text as source,
      e.category,
      e.topic,
      e.first_seen,
      e.last_seen,
      e.status,
      e.response_sent,
      case when e.response_sent then 'gmail' else 'none' end as response_channel,
      1::integer as occurrence_count
    from private.support_insight_events e
    where e.linked_dashboard_request_id is null
      and e.first_seen between p_from and p_to
  )
  select * from dashboard_rows
  union all
  select * from gmail_rows
  order by last_seen desc, issue_key
  limit 500;
end;
$$;

revoke all on function public.support_improvement_report(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.support_improvement_report(timestamptz, timestamptz) to authenticated;

commit;
