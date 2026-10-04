-- Participant help requests and administrator support inbox.
-- Allows multiple messages per participant while keeping messages private.

begin;

lock table public.survey_responses in share row exclusive mode;

-- The original table treated feedback as a one-time survey. Support must allow
-- the same participant to ask for help more than once.
alter table public.survey_responses
  drop constraint if exists survey_responses_user_id_key;

alter table public.survey_responses
  add column if not exists category text not null default 'feedback',
  add column if not exists status text not null default 'new',
  add column if not exists updated_at timestamptz not null default now();

alter table public.survey_responses
  drop constraint if exists survey_responses_category_check,
  drop constraint if exists survey_responses_status_check,
  drop constraint if exists survey_responses_feedback_length_check;

alter table public.survey_responses
  add constraint survey_responses_category_check
    check (category in ('feedback', 'help', 'problem', 'idea')),
  add constraint survey_responses_status_check
    check (status in ('new', 'in_progress', 'resolved')),
  add constraint survey_responses_feedback_length_check
    check (char_length(btrim(feedback)) between 1 and 2000);

create index if not exists survey_responses_status_created_idx
  on public.survey_responses (status, created_at desc);

-- Recreate participant insert access so callers cannot forge a triaged status.
drop policy if exists "survey_insert_own" on public.survey_responses;
create policy "survey_insert_own"
on public.survey_responses
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'new'
  and category in ('help', 'problem', 'idea')
);

-- Existing private-select policy lets participants read only their own requests
-- and administrators read all requests.
drop policy if exists "survey_update_admin" on public.survey_responses;
create policy "survey_update_admin"
on public.survey_responses
for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

revoke update on table public.survey_responses from authenticated;
grant update (status, updated_at) on table public.survey_responses to authenticated;
revoke all on table public.survey_responses from anon;

-- Transactional safety checks. Any failed assumption rolls the migration back.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.survey_responses'::regclass
      and conname = 'survey_responses_user_id_key'
  ) then
    raise exception 'Support requests are still limited to one row per participant.';
  end if;

  if not has_column_privilege('authenticated', 'public.survey_responses', 'status', 'UPDATE') then
    raise exception 'Authenticated administrator clients cannot update support status.';
  end if;

  if has_column_privilege('authenticated', 'public.survey_responses', 'feedback', 'UPDATE')
     or has_column_privilege('authenticated', 'public.survey_responses', 'user_id', 'UPDATE') then
    raise exception 'Support message identity/content is unexpectedly writable.';
  end if;

  if has_table_privilege('anon', 'public.survey_responses', 'SELECT')
     or has_table_privilege('anon', 'public.survey_responses', 'INSERT')
     or has_table_privilege('anon', 'public.survey_responses', 'UPDATE') then
    raise exception 'Anonymous support access is unexpectedly enabled.';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'survey_responses'
      and policyname = 'survey_update_admin'
      and cmd = 'UPDATE'
  ) then
    raise exception 'Administrator support-update policy is missing.';
  end if;
end;
$$;

commit;
