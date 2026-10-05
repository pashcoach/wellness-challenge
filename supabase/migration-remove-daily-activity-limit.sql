-- Remove the hard daily activity cap. Participants may enter a week's
-- activities in one sitting, provided each entry uses the date it occurred.
-- High daily totals remain visible in the private administrator audit queue.

drop trigger if exists enforce_daily_activity_limit on public.activity_entries;
drop function if exists public.enforce_daily_activity_limit();
