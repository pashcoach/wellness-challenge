-- Committee-approved deadline: Friday Oct 30, 2026 NOON America/Regina = 18:00Z.
-- Apply after migration-challenge-logging-close.sql. Safe to rerun.
-- Schema-only helper replacement: no participant DML, trigger recreation,
-- scoring, grants, admin/prize paths, or draw changes.
begin;

-- Fail closed if the previously installed guards are missing or disabled.
do $$
begin
  if (select count(*) from pg_trigger t
      where (t.tgrelid, t.tgname) in (
        ('public.activity_entries'::regclass, 'enforce_challenge_logging_close_activity'),
        ('public.wellness_checkins'::regclass, 'enforce_challenge_logging_close_checkins'))
      and t.tgfoid = 'public.enforce_challenge_logging_close()'::regprocedure
      and t.tgtype = 30
      and t.tgenabled = 'O') <> 2 then
    raise exception 'Expected existing enabled logging-close statement guards; stop and inspect';
  end if;
end;
$$;

-- CREATE OR REPLACE preserves the existing function identity and ACL.
create or replace function public.challenge_logging_is_closed(p_now timestamptz default clock_timestamp())
returns boolean
language sql
volatile
set search_path = ''
as $$
  select p_now >= timestamptz '2026-10-30T12:00:00-06:00';
$$;

do $$
begin
  if public.challenge_logging_is_closed('2026-10-30T17:59:59.999999Z')
    or not public.challenge_logging_is_closed('2026-10-30T18:00:00Z')
    or not public.challenge_logging_is_closed('2026-10-30T18:00:00.000001Z')
    or not public.challenge_logging_is_closed('2026-10-31T06:00:00Z') then
    raise exception 'Noon logging cutoff boundary self-test failed';
  end if;
end;
$$;

commit;
