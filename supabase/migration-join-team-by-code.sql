-- Join a team by pasting the team code a teammate shared.
-- Reuses public.join_team so the first-entry lock, the "leave your
-- current team first" rule, and row locking stay identical.

create or replace function public.join_team_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_team uuid;
begin
  if v_code = '' then
    raise exception 'No team matches that code.';
  end if;

  select t.id into v_team
  from public.teams t
  where upper(t.join_code) = v_code;

  if v_team is null then
    raise exception 'No team matches that code.';
  end if;

  perform public.join_team(v_team);
  return v_team;
end;
$$;

revoke all on function public.join_team_by_code(text) from public, anon, authenticated;
grant execute on function public.join_team_by_code(text) to authenticated;
