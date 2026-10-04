-- Daily registration stats — v1
-- Security-definer function that reports true registration counts regardless of
-- row-level security, so the daily cron report can count all participants.
-- `p_since` is the UTC timestamp of the start of the Saskatchewan "today".
-- Callable by anon via PostgREST: POST /rest/v1/rpc/get_registration_stats

create or replace function public.get_registration_stats(p_since timestamptz)
returns table (
  total_count     bigint,
  new_today_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    count(*)::bigint,
    count(*) filter (where profiles.created_at >= p_since)::bigint
  from public.profiles;
$$;

-- Allow the public (anon) role to call it.
revoke all on function public.get_registration_stats(timestamptz) from public;
grant execute on function public.get_registration_stats(timestamptz) to anon;