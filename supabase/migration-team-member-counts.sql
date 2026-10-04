-- Privacy-safe team member counts
-- Returns only a team UUID and aggregate count; no participant rows or
-- demographic fields are exposed.

begin;

create or replace function public.get_team_member_counts()
returns table (team_id uuid, member_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.team_id, count(*)::bigint as member_count
  from public.profiles p
  where p.team_id is not null
  group by p.team_id
  order by p.team_id;
$$;

revoke all on function public.get_team_member_counts() from public, anon, authenticated;
grant execute on function public.get_team_member_counts() to authenticated;

-- Permission and aggregate integrity checks.
do $$
declare
  v_expected bigint;
  v_actual bigint;
begin
  if has_function_privilege('anon', 'public.get_team_member_counts()', 'EXECUTE') then
    raise exception 'Team count self-test failed: anon can execute aggregate';
  end if;
  if not has_function_privilege('authenticated', 'public.get_team_member_counts()', 'EXECUTE') then
    raise exception 'Team count self-test failed: authenticated cannot execute aggregate';
  end if;

  select count(*) into v_expected
  from public.profiles
  where team_id is not null;

  select coalesce(sum(member_count), 0) into v_actual
  from public.get_team_member_counts();

  if v_actual <> v_expected then
    raise exception 'Team count self-test failed: aggregate mismatch';
  end if;
end;
$$;

commit;
