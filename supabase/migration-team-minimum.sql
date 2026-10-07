-- Close team setup after Week 1 and remove teams with fewer than two members.
-- Team deletion moves the sole member to solo participation through the
-- profiles.team_id foreign key while preserving entries, points, and locks.

begin;

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
    and public.solo_week_one_join_open();
$$;

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
    and public.solo_week_one_join_open();
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
  if not public.solo_week_one_join_open() then
    raise exception 'Team setup closed after October 11.';
  end if;
end;
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
  if not public.solo_week_one_join_open() then
    raise exception 'Team setup closed after October 11.';
  end if;
end;
$$;

create table if not exists public.team_minimum_cleanup_runs (
  run_key text primary key check (run_key = '2026-10-12'),
  deleted_team_count integer not null check (deleted_team_count >= 0),
  soloed_participant_count integer not null check (soloed_participant_count >= 0),
  deleted_team_ids uuid[] not null default '{}',
  completed_at timestamptz not null default clock_timestamp()
);

alter table public.team_minimum_cleanup_runs enable row level security;
revoke all on table public.team_minimum_cleanup_runs from public, anon, authenticated, service_role;

create or replace function public.admin_enforce_team_minimum(p_at timestamptz default now())
returns table (deleted_teams integer, soloed_participants integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_ids uuid[] := '{}'::uuid[];
  v_deleted integer := 0;
  v_soloed integer := 0;
begin
  if timezone('America/Regina', p_at)::date < date '2026-10-12' then
    raise exception 'The two-member team deadline has not passed.';
  end if;

  if exists (
    select 1 from public.team_minimum_cleanup_runs r where r.run_key = '2026-10-12'
  ) then
    raise exception 'The 2026 team-minimum cleanup has already run.';
  end if;

  -- Use the same profile-then-team lock order as participant team functions.
  perform p.id from public.profiles p order by p.id for update;
  perform t.id from public.teams t order by t.id for update;

  -- Recheck after acquiring locks so concurrent cleanup calls fail closed.
  if exists (
    select 1 from public.team_minimum_cleanup_runs r where r.run_key = '2026-10-12'
  ) then
    raise exception 'The 2026 team-minimum cleanup has already run.';
  end if;

  select coalesce(array_agg(underfilled.id order by underfilled.id), '{}'::uuid[])
  into v_team_ids
  from (
    select t.id
    from public.teams t
    left join public.profiles p on p.team_id = t.id
    group by t.id
    having count(p.id) < 2
  ) underfilled;

  select count(*)::integer into v_soloed
  from public.profiles p
  where p.team_id = any(v_team_ids);

  delete from public.teams t
  where t.id = any(v_team_ids);
  get diagnostics v_deleted = row_count;

  insert into public.team_minimum_cleanup_runs (
    run_key, deleted_team_count, soloed_participant_count, deleted_team_ids
  ) values ('2026-10-12', v_deleted, v_soloed, v_team_ids);

  return query select v_deleted, v_soloed;
end;
$$;

revoke all on function public.can_current_user_join_team() from public, anon, authenticated;
revoke all on function public.can_current_user_create_team() from public, anon, authenticated;
revoke all on function public.require_team_join_allowed() from public, anon, authenticated;
revoke all on function public.require_team_create_allowed() from public, anon, authenticated;
revoke all on function public.admin_enforce_team_minimum(timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.can_current_user_join_team() to authenticated;
grant execute on function public.can_current_user_create_team() to authenticated;

commit;
