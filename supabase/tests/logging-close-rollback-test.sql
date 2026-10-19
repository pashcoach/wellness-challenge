-- Rollback-only verification. No participant table writes: all DML targets a
-- temporary probe. Run AFTER migration-challenge-logging-close.sql.
-- Function overrides below are transaction-local and restored by ROLLBACK.
begin;

do $$
begin
  if public.challenge_logging_is_closed('2026-10-30T18:00:00Z')
    or public.challenge_logging_is_closed('2026-10-31T05:59:59.999999Z')
    or not public.challenge_logging_is_closed('2026-10-31T06:00:00Z')
    or not public.challenge_logging_is_closed('2026-10-31T06:00:00.000001Z') then
    raise exception 'FAIL cutoff boundaries';
  end if;
  if (select count(*) from pg_trigger t
      where (t.tgrelid, t.tgname) in (
        ('public.activity_entries'::regclass, 'enforce_challenge_logging_close_activity'),
        ('public.wellness_checkins'::regclass, 'enforce_challenge_logging_close_checkins'))
      and t.tgfoid = 'public.enforce_challenge_logging_close()'::regprocedure
      and t.tgtype = 30 -- BEFORE STATEMENT INSERT + UPDATE + DELETE
      and t.tgenabled = 'O') <> 2 then
    raise exception 'FAIL expected two enabled write-guard triggers';
  end if;
  if has_function_privilege('anon', 'public.challenge_logging_is_closed(timestamptz)', 'execute')
    or has_function_privilege('authenticated', 'public.enforce_challenge_logging_close()', 'execute') then
    raise exception 'FAIL helper grants';
  end if;
end;
$$;

create temporary table logging_close_probe (id integer);
create trigger probe_close before insert or update or delete on logging_close_probe
for each statement execute function public.enforce_challenge_logging_close();
grant select, insert, update, delete on logging_close_probe to authenticated;

-- Simulate one microsecond before the deadline, without touching server time.
create or replace function public.challenge_logging_is_closed(p_now timestamptz default clock_timestamp())
returns boolean language sql volatile set search_path = '' as $$
  select timestamptz '2026-10-31T05:59:59.999999Z' >= timestamptz '2026-10-31T06:00:00Z';
$$;
insert into logging_close_probe values (1);
update logging_close_probe set id = 2;
delete from logging_close_probe;
insert into logging_close_probe values (1);

-- Simulate exact cutoff, including a transaction which started before it.
create or replace function public.challenge_logging_is_closed(p_now timestamptz default clock_timestamp())
returns boolean language sql volatile set search_path = '' as $$
  select timestamptz '2026-10-31T06:00:00Z' >= timestamptz '2026-10-31T06:00:00Z';
$$;

set local role authenticated;
do $$
declare
  operation text;
  blocked integer := 0;
begin
  foreach operation in array array[
    'insert into logging_close_probe values (3)',
    'update logging_close_probe set id = 4',
    'delete from logging_close_probe',
    'insert into logging_close_probe select 5 where false',
    'update logging_close_probe set id = 6 where false',
    'delete from logging_close_probe where false'
  ] loop
    begin
      execute operation;
    exception when sqlstate 'P0001' then
      if sqlerrm <> 'Challenge logging is closed.' then raise; end if;
      blocked := blocked + 1;
    end;
  end loop;
  if blocked <> 6 or (select count(*) from logging_close_probe) <> 1 then
    raise exception 'FAIL closed writes or read-only access';
  end if;
  raise notice 'PASS boundaries; both table guards; INSERT/UPDATE/DELETE and zero-row writes blocked; reads unchanged';
end;
$$;
reset role;

rollback;
-- Confirm original helper was restored, no persistent test changes.
select not public.challenge_logging_is_closed('2026-10-31T05:59:59.999999Z')
  and public.challenge_logging_is_closed('2026-10-31T06:00:00Z') as restored_cutoff_pass;
