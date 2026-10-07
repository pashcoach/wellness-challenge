-- Let a solo participant create a team during Week 1 even after their first
-- entry. Leaving, deleting, and switching teams remain locked.

begin;

create or replace function public.can_current_user_create_team()
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

create or replace function public.require_team_create_allowed()
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
    raise exception 'Leave your current team before creating another team.';
  end if;

  if exists (
    select 1 from public.participant_team_locks l where l.user_id = auth.uid()
  ) and not public.solo_week_one_join_open() then
    raise exception 'Creating a team after your first entry is only available to solo participants during Week 1.';
  end if;
end;
$$;

create or replace function public.create_team_and_join(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid := gen_random_uuid();
  v_name text := btrim(p_name);
begin
  perform public.require_team_create_allowed();

  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'Team names must be between 1 and 80 characters.';
  end if;

  insert into public.teams (id, name, join_code, created_by)
  values (
    v_team,
    v_name,
    upper(substr(replace(v_team::text, '-', ''), 1, 6)),
    auth.uid()
  );

  update public.profiles set team_id = v_team where id = auth.uid();
  return v_team;
end;
$$;

revoke all on function public.can_current_user_create_team() from public, anon, authenticated;
revoke all on function public.require_team_create_allowed() from public, anon, authenticated;
revoke all on function public.create_team_and_join(text) from public, anon, authenticated;
grant execute on function public.can_current_user_create_team() to authenticated;
grant execute on function public.create_team_and_join(text) to authenticated;

commit;
