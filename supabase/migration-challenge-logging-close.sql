-- FCL 2026 logging close: midnight STARTING Oct 31, America/Regina (UTC−06).
-- Schema only: no participant records, scoring, eligibility, or draws are changed.
-- Additive guard preserves existing normalization, audit, and RLS rules.
begin;

create or replace function public.challenge_logging_is_closed(p_now timestamptz default clock_timestamp())
returns boolean
language sql
volatile
set search_path = ''
as $$
  select p_now >= timestamptz '2026-10-31T00:00:00-06:00';
$$;

create or replace function public.enforce_challenge_logging_close()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Wall clock, not transaction start: a transaction begun earlier cannot
  -- submit a later statement after the deadline. No admin/service-role bypass.
  if public.challenge_logging_is_closed() then
    raise exception using errcode = 'P0001', message = 'Challenge logging is closed.';
  end if;
  return null; -- Statement-level BEFORE trigger; no row is modified here.
end;
$$;

revoke all on function public.challenge_logging_is_closed(timestamptz) from public, anon, authenticated;
revoke all on function public.enforce_challenge_logging_close() from public, anon, authenticated;

-- A statement guard also rejects zero-row writes and runs before row-level
-- scoring/audit triggers. Backdating an entry cannot bypass the close.
drop trigger if exists enforce_challenge_logging_close_activity on public.activity_entries;
create trigger enforce_challenge_logging_close_activity
before insert or update or delete on public.activity_entries
for each statement execute function public.enforce_challenge_logging_close();

drop trigger if exists enforce_challenge_logging_close_checkins on public.wellness_checkins;
create trigger enforce_challenge_logging_close_checkins
before insert or update or delete on public.wellness_checkins
for each statement execute function public.enforce_challenge_logging_close();

do $$
begin
  if public.challenge_logging_is_closed('2026-10-30T18:00:00Z')
    or public.challenge_logging_is_closed('2026-10-31T05:59:59.999999Z')
    or not public.challenge_logging_is_closed('2026-10-31T06:00:00Z')
    or not public.challenge_logging_is_closed('2026-10-31T06:00:00.000001Z') then
    raise exception 'Logging cutoff boundary self-test failed';
  end if;
end;
$$;

commit;
