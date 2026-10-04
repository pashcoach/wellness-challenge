-- Transactional, irreversible team-management rules.

begin;

-- This marker is permanent for the participant, even if entries are later deleted.
create table if not exists public.participant_team_locks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  locked_at timestamptz not null default now()
);

alter table public.participant_team_locks enable row level security;
revoke all on table public.participant_team_locks from public, anon, authenticated;

-- Block entry writes until both the historical backfill and entry triggers are
-- installed. This closes the migration-time gap between those two operations.
lock table public.profiles, public.teams, public.activity_entries, public.wellness_checkins
in share row exclusive mode;

-- Preserve the rule for anyone who already logged an entry before this migration.
insert into public.participant_team_locks (user_id)
select user_id from public.activity_entries
union
select user_id from public.wellness_checkins
on conflict (user_id) do nothing;

-- Every first entry locks the participant's profile row. Team RPCs use the same
-- row lock, so a first entry and a team change cannot commit concurrently.
create or replace function public.lock_team_changes_on_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.profiles p where p.id = new.user_id for update;
  insert into public.participant_team_locks (user_id)
  values (new.user_id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists lock_team_changes_on_activity on public.activity_entries;
create trigger lock_team_changes_on_activity
before insert on public.activity_entries
for each row execute function public.lock_team_changes_on_entry();

drop trigger if exists lock_team_changes_on_checkin on public.wellness_checkins;
create trigger lock_team_changes_on_checkin
before insert on public.wellness_checkins
for each row execute function public.lock_team_changes_on_entry();

create or replace function public.require_team_changes_allowed()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;

  perform 1
  from public.profiles p
  where p.id = auth.uid()
  for update;

  if not found then
    raise exception 'Participant profile not found.';
  end if;

  if exists (
    select 1 from public.participant_team_locks l where l.user_id = auth.uid()
  ) then
    raise exception 'Team changes are locked after your first wellness activity or weekly check-in.';
  end if;
end;
$$;

create or replace function public.can_current_user_change_teams()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (select 1 from public.profiles p where p.id = auth.uid())
    and not exists (
      select 1 from public.participant_team_locks l where l.user_id = auth.uid()
    );
$$;

-- Aggregate-only helpers avoid exposing profile membership rows.
create or replace function public.get_team_member_counts()
returns table (team_id uuid, member_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.team_id, count(*)::bigint
  from public.profiles p
  where p.team_id is not null
  group by p.team_id
  order by p.team_id;
$$;

create or replace function public.get_my_team_member_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.profiles member
  where member.team_id = (
    select me.team_id from public.profiles me where me.id = auth.uid()
  )
  and member.team_id is not null;
$$;

-- Existing profile flags were historically self-editable, so they are not a
-- trustworthy authorization source. Reconcile the UI mirror exclusively from
-- Supabase Auth app metadata, which participants cannot modify themselves.
update public.profiles p
set is_admin = exists (
  select 1
  from auth.users u
  where u.id = p.id
    and u.raw_app_meta_data ->> 'is_admin' = 'true'
);

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and u.raw_app_meta_data ->> 'is_admin' = 'true'
  );
$$;

-- Raw challenge entries are private to their owner and administrators. Public
-- standings continue through the aggregate leaderboard views; teammate activity
-- continues through get_my_team_activity().
drop policy if exists "activity_read_all" on public.activity_entries;
drop policy if exists "activity_read_own_or_admin" on public.activity_entries;
create policy "activity_read_own_or_admin"
on public.activity_entries for select to authenticated
using (user_id = auth.uid() or public.is_current_user_admin());

drop policy if exists "checkins_read_all" on public.wellness_checkins;
drop policy if exists "checkins_read_own_or_admin" on public.wellness_checkins;
create policy "checkins_read_own_or_admin"
on public.wellness_checkins for select to authenticated
using (user_id = auth.uid() or public.is_current_user_admin());

-- Repair legacy ownerless/mismatched teams, then make ownership durable. A
-- creator-profile deletion transfers ownership in the BEFORE DELETE trigger;
-- a sole creator must leave/delete the team before deleting their profile.
delete from public.teams t
where (
  t.created_by is null
  or not exists (
    select 1 from public.profiles owner
    where owner.id = t.created_by and owner.team_id = t.id
  )
)
and not exists (
  select 1 from public.profiles member where member.team_id = t.id
);

update public.teams t
set created_by = (
  select member.id
  from public.profiles member
  where member.team_id = t.id
  order by member.created_at asc, member.id asc
  limit 1
)
where t.created_by is null
   or not exists (
     select 1 from public.profiles owner
     where owner.id = t.created_by and owner.team_id = t.id
   );

alter table public.teams drop constraint if exists teams_created_by_fkey;
alter table public.teams alter column created_by set not null;
alter table public.teams
  add constraint teams_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete restrict;

create or replace function public.preserve_team_ownership_on_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team record;
  v_next_creator uuid;
  v_prelocked_members uuid[] := array[]::uuid[];
begin
  -- Capture and lock every replacement visible before taking team locks.
  select coalesce(array_agg(member.id order by member.id), array[]::uuid[])
  into v_prelocked_members
  from public.profiles member
  where member.id <> old.id
    and exists (
      select 1
      from public.teams owned_team
      where owned_team.created_by = old.id
        and owned_team.id = member.team_id
    );

  perform member.id
  from public.profiles member
  where member.id = any(v_prelocked_members)
  order by member.id
  for update;

  for v_team in
    select t.id
    from public.teams t
    where t.created_by = old.id
    order by t.id
    for update
  loop
    -- A join can commit after the prelock scan but before this team lock. Do
    -- not select that unprelocked profile as owner; abort for a safe retry.
    if exists (
      select 1
      from public.profiles member
      where member.team_id = v_team.id
        and member.id <> old.id
        and not (member.id = any(v_prelocked_members))
    ) then
      raise exception using
        errcode = '40001',
        message = 'Team membership changed. Please try again.';
    end if;

    v_next_creator := null;
    select member.id into v_next_creator
    from public.profiles member
    where member.team_id = v_team.id
      and member.id <> old.id
    order by member.created_at asc, member.id asc
    limit 1;

    if v_next_creator is not null then
      update public.teams
      set created_by = v_next_creator
      where id = v_team.id;
    else
      raise exception 'Leave or delete your team before deleting your participant profile.';
    end if;
  end loop;
  return old;
end;
$$;

drop trigger if exists preserve_team_ownership_before_profile_delete on public.profiles;
create trigger preserve_team_ownership_before_profile_delete
before delete on public.profiles
for each row execute function public.preserve_team_ownership_on_profile_delete();

drop policy if exists "profiles_read_all" on public.profiles;
drop policy if exists "profiles_read_own_or_admin" on public.profiles;
create policy "profiles_read_own_or_admin"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_current_user_admin());

-- Team discovery is available only after sign-in. Join codes and creator IDs must
-- never be enumerable through the anonymous REST role.
drop policy if exists "teams_read_all" on public.teams;
drop policy if exists "teams_read_authenticated" on public.teams;
create policy "teams_read_authenticated"
on public.teams for select to authenticated
using (true);
revoke select on table public.teams from public;
revoke select on table public.teams from anon;
grant select on table public.teams to authenticated;

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert to authenticated
with check (
  id = auth.uid()
  and team_id is null
  and is_admin = false
);

create or replace function public.get_my_team_roster()
returns table (id uuid, full_name text, username text)
language sql
stable
security definer
set search_path = ''
as $$
  select member.id, member.full_name, member.username
  from public.profiles me
  join public.profiles member on member.team_id = me.team_id
  where me.id = auth.uid()
    and me.team_id is not null
  order by member.id;
$$;

create or replace function public.get_my_team_activity()
returns table (
  id uuid,
  activity text,
  minutes integer,
  points integer,
  created_at timestamptz,
  full_name text,
  username text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.activity,
    a.minutes,
    a.points,
    a.created_at,
    member.full_name,
    member.username
  from public.profiles me
  join public.profiles member on member.team_id = me.team_id
  join public.activity_entries a on a.user_id = member.id
  where me.id = auth.uid()
    and me.team_id is not null
  order by a.created_at desc
  limit 10;
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
  v_current_team uuid;
begin
  perform public.require_team_changes_allowed();

  select p.team_id into v_current_team
  from public.profiles p
  where p.id = auth.uid();

  if v_current_team is not null then
    raise exception 'Leave your current team before creating another team.';
  end if;

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

create or replace function public.join_team(p_team uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_team uuid;
begin
  perform public.require_team_changes_allowed();

  select p.team_id into v_current_team
  from public.profiles p
  where p.id = auth.uid();

  if v_current_team is not null then
    raise exception 'Leave your current team before joining another team.';
  end if;

  perform 1 from public.teams t where t.id = p_team for update;
  if not found then
    raise exception 'That team no longer exists.';
  end if;

  update public.profiles set team_id = p_team where id = auth.uid();
  return true;
end;
$$;

create or replace function public.leave_current_team()
returns table (team_deleted boolean, ownership_transferred boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_creator uuid;
  v_next_creator uuid;
  v_was_creator boolean := false;
  v_prelocked_members uuid[] := array[]::uuid[];
begin
  perform public.require_team_changes_allowed();

  select p.team_id into v_team
  from public.profiles p
  where p.id = auth.uid();

  if v_team is null then
    team_deleted := false;
    ownership_transferred := false;
    return next;
    return;
  end if;

  -- Only the current owner may need to update teams.created_by. Lock possible
  -- replacements before the team row so their concurrent leave can finish
  -- first instead of forming a profile -> team -> profile deadlock cycle.
  select exists (
    select 1
    from public.teams owner_check
    where owner_check.id = v_team
      and owner_check.created_by = auth.uid()
  ) into v_was_creator;

  if v_was_creator then
    select coalesce(array_agg(member.id order by member.id), array[]::uuid[])
    into v_prelocked_members
    from public.profiles member
    where member.team_id = v_team
      and member.id <> auth.uid();

    perform member.id
    from public.profiles member
    where member.id = any(v_prelocked_members)
    order by member.id
    for update;
  end if;

  select t.created_by into v_creator
  from public.teams t
  where t.id = v_team
  for update;

  -- Ownership can change while a non-owner waits for the team lock. Abort
  -- safely and let the caller retry rather than lock a replacement profile
  -- after the team row and reintroduce the deadlock cycle.
  if v_creator = auth.uid() and not v_was_creator then
    raise exception using
      errcode = '40001',
      message = 'Team ownership changed. Please try again.';
  end if;

  if v_creator = auth.uid() and exists (
    select 1
    from public.profiles member
    where member.team_id = v_team
      and member.id <> auth.uid()
      and not (member.id = any(v_prelocked_members))
  ) then
    raise exception using
      errcode = '40001',
      message = 'Team membership changed. Please try again.';
  end if;

  if v_creator = auth.uid() then
    select p.id into v_next_creator
    from public.profiles p
    where p.team_id = v_team
      and p.id <> auth.uid()
    order by p.created_at asc, p.id asc
    limit 1;

    if v_next_creator is null then
      delete from public.teams where id = v_team;
      team_deleted := true;
      ownership_transferred := false;
      return next;
      return;
    end if;

    update public.teams
    set created_by = v_next_creator
    where id = v_team;
    ownership_transferred := true;
  else
    ownership_transferred := false;
  end if;

  update public.profiles set team_id = null where id = auth.uid();
  team_deleted := false;
  return next;
end;
$$;

create or replace function public.delete_my_team()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_creator uuid;
  v_member_count integer;
begin
  perform public.require_team_changes_allowed();

  select p.team_id into v_team
  from public.profiles p
  where p.id = auth.uid();

  if v_team is null then
    raise exception 'You are not currently on a team.';
  end if;

  select t.created_by into v_creator
  from public.teams t
  where t.id = v_team
  for update;

  if v_creator is distinct from auth.uid() then
    raise exception 'Only the team creator can delete this team.';
  end if;

  select count(*) into v_member_count
  from public.profiles p
  where p.team_id = v_team;

  if v_member_count > 1 then
    raise exception 'This team cannot be deleted until you are its only remaining member.';
  end if;

  delete from public.teams where id = v_team;
  return true;
end;
$$;

-- Participants can change team membership only through the transactional RPCs.
revoke update on table public.profiles from authenticated;
grant update (full_name, username, business_unit, located_at_crc, age_range)
on table public.profiles to authenticated;
revoke insert on table public.profiles from authenticated;
grant insert (id, full_name, username, business_unit, located_at_crc, age_range)
on table public.profiles to authenticated;
revoke insert on table public.teams from authenticated;
revoke update on table public.teams from authenticated;
revoke delete on table public.teams from authenticated;

revoke all on function public.lock_team_changes_on_entry() from public, anon, authenticated;
revoke all on function public.require_team_changes_allowed() from public, anon, authenticated;
revoke all on function public.can_current_user_change_teams() from public, anon, authenticated;
revoke all on function public.get_team_member_counts() from public, anon, authenticated;
revoke all on function public.get_my_team_member_count() from public, anon, authenticated;
revoke all on function public.is_current_user_admin() from public, anon, authenticated;
revoke all on function public.preserve_team_ownership_on_profile_delete() from public, anon, authenticated;
revoke all on function public.get_my_team_roster() from public, anon, authenticated;
revoke all on function public.get_my_team_activity() from public, anon, authenticated;
revoke all on function public.create_team_and_join(text) from public, anon, authenticated;
revoke all on function public.join_team(uuid) from public, anon, authenticated;
revoke all on function public.leave_current_team() from public, anon, authenticated;
revoke all on function public.delete_my_team() from public, anon, authenticated;

grant execute on function public.can_current_user_change_teams() to authenticated;
grant execute on function public.get_team_member_counts() to authenticated;
grant execute on function public.get_my_team_member_count() to authenticated;
grant execute on function public.is_current_user_admin() to authenticated;
grant execute on function public.get_my_team_roster() to authenticated;
grant execute on function public.get_my_team_activity() to authenticated;
grant execute on function public.create_team_and_join(text) to authenticated;
grant execute on function public.join_team(uuid) to authenticated;
grant execute on function public.leave_current_team() to authenticated;
grant execute on function public.delete_my_team() to authenticated;

-- Structural checks fail if direct writes or serialization safeguards drift.
do $$
begin
  if has_column_privilege('authenticated', 'public.profiles', 'team_id', 'UPDATE') then
    raise exception 'Team management migration failed: direct team_id updates remain allowed';
  end if;
  if has_column_privilege('authenticated', 'public.profiles', 'team_id', 'INSERT')
     or has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'INSERT') then
    raise exception 'Team management migration failed: privileged profile fields remain insertable';
  end if;
  if has_table_privilege('authenticated', 'public.teams', 'INSERT') then
    raise exception 'Team management migration failed: direct team creation remains allowed';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.activity_entries'::regclass
      and tgname = 'lock_team_changes_on_activity'
      and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.wellness_checkins'::regclass
      and tgname = 'lock_team_changes_on_checkin'
      and not tgisinternal
  ) then
    raise exception 'Team management migration failed: entry lock trigger is missing';
  end if;
  if has_function_privilege('anon', 'public.leave_current_team()', 'EXECUTE')
     or has_function_privilege('anon', 'public.delete_my_team()', 'EXECUTE') then
    raise exception 'Team management migration failed: anonymous execution is allowed';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_read_all'
  ) then
    raise exception 'Team management migration failed: broad profile reads remain allowed';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('activity_entries', 'wellness_checkins')
      and policyname in ('activity_read_all', 'checkins_read_all')
  ) then
    raise exception 'Team management migration failed: broad challenge-entry reads remain allowed';
  end if;
  if exists (select 1 from public.teams where created_by is null) then
    raise exception 'Team management migration failed: an ownerless team remains';
  end if;
end;
$$;

commit;
