-- Let a solo participant join one existing team during Week 1 even after
-- their first entry. Creating, leaving, deleting, and switching remain locked.

begin;

create or replace function public.solo_week_one_join_open(p_at timestamptz default now())
returns boolean
language sql
stable
set search_path = ''
as $$
  select timezone('America/Regina', p_at)::date between date '2026-10-05' and date '2026-10-11';
$$;

create or replace function public.can_current_user_join_team()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.team_id is null
    )
    and (
      not exists (
        select 1
        from public.participant_team_locks l
        where l.user_id = auth.uid()
      )
      or public.solo_week_one_join_open()
    );
$$;

create or replace function public.require_team_join_allowed()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_team uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;

  select p.team_id into v_current_team
  from public.profiles p
  where p.id = auth.uid()
  for update;

  if not found then
    raise exception 'Participant profile not found.';
  end if;

  if v_current_team is not null then
    raise exception 'Leave your current team before joining another team.';
  end if;

  if exists (
    select 1 from public.participant_team_locks l where l.user_id = auth.uid()
  ) and not public.solo_week_one_join_open() then
    raise exception 'Joining a team after your first entry is only available to solo participants during Week 1.';
  end if;
end;
$$;

create or replace function public.join_team(p_team uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_team_join_allowed();

  perform 1 from public.teams t where t.id = p_team for update;
  if not found then
    raise exception 'That team no longer exists.';
  end if;

  update public.profiles set team_id = p_team where id = auth.uid();
  return true;
end;
$$;

revoke all on function public.solo_week_one_join_open(timestamptz) from public, anon, authenticated;
revoke all on function public.can_current_user_join_team() from public, anon, authenticated;
revoke all on function public.require_team_join_allowed() from public, anon, authenticated;
revoke all on function public.join_team(uuid) from public, anon, authenticated;
grant execute on function public.can_current_user_join_team() to authenticated;
grant execute on function public.join_team(uuid) to authenticated;

commit;
