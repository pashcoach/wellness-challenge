-- Pre-challenge data lock — v1
-- Blocks any activity or check-in insert dated before the challenge start
-- (October 5, 2026) at the database level, so the "no data before Oct 5" rule
-- holds even against a tampered client that bypasses the UI lock.
-- Safe to re-run (idempotent: or replace / drop trigger if exists).
-- Run this in the Supabase SQL editor.

create or replace function block_prechallenge_activity()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.entry_date < date '2026-10-05' then
    raise exception 'Activity logging opens on October 5, 2026.'
      using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

create or replace function block_prechallenge_checkin()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.entry_date < date '2026-10-05' then
    raise exception 'Wellness check-ins open on October 5, 2026.'
      using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

drop trigger if exists block_prechallenge_activity on activity_entries;
create trigger block_prechallenge_activity
before insert on activity_entries
for each row execute function block_prechallenge_activity();

drop trigger if exists block_prechallenge_checkin on wellness_checkins;
create trigger block_prechallenge_checkin
before insert on wellness_checkins
for each row execute function block_prechallenge_checkin();

-- Verify the triggers exist and block a pre-start insert:
select tgname, tgrelid::regclass as on_table
from pg_trigger
where tgname in ('block_prechallenge_activity', 'block_prechallenge_checkin');