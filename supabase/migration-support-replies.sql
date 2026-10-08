-- Typed app-team replies to participant support requests.
-- Replies are written only by the reply-support-request Edge Function
-- (service role, after an administrator check). Participants can read
-- replies to their own requests; administrators can read all replies.

begin;

create table if not exists public.support_replies (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.survey_responses(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  email_sent_at timestamptz
);

create index if not exists support_replies_request_created_idx
  on public.support_replies (request_id, created_at);

alter table public.support_replies enable row level security;

drop policy if exists "support_replies_read_own_or_admin" on public.support_replies;
create policy "support_replies_read_own_or_admin"
on public.support_replies
for select
to authenticated
using (
  public.is_current_user_admin()
  or exists (
    select 1 from public.survey_responses r
    where r.id = support_replies.request_id
      and r.user_id = auth.uid()
  )
);

revoke all on table public.support_replies from public, anon, authenticated;
grant select on table public.support_replies to authenticated;

do $$
begin
  if has_table_privilege('authenticated', 'public.support_replies', 'INSERT')
     or has_table_privilege('authenticated', 'public.support_replies', 'UPDATE')
     or has_table_privilege('authenticated', 'public.support_replies', 'DELETE')
     or has_table_privilege('anon', 'public.support_replies', 'SELECT') then
    raise exception 'Support replies must be server-written and private.';
  end if;
end;
$$;

commit;
