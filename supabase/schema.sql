-- FCL CRC Wellness Challenge 2026 — Supabase schema
-- Run this in the Supabase SQL editor after creating the project.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text,
  business_unit text not null,
  located_at_crc boolean not null default false,
  age_range text not null,
  team_id uuid,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- If the table already exists, add the username column:
alter table profiles add column if not exists username text;

create table if not exists participant_acknowledgements (
  user_id uuid primary key references profiles(id) on delete cascade,
  disclaimer_version text not null,
  health_risk_accepted_at timestamptz not null,
  privacy_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helper must exist before the teams table uses it as a column default.
create or replace function gen_join_code() returns text language sql as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique default gen_join_code(),
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table profiles
  add constraint profiles_team_fk
  foreign key (team_id) references teams(id) on delete set null;

create table if not exists activity_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  activity text not null,
  minutes integer not null check (minutes > 0),
  points integer not null,
  entry_date date not null,
  week integer not null,
  created_at timestamptz not null default now()
);

create table if not exists wellness_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  week integer not null,
  pillar text not null,
  comment text,
  points integer not null,
  entry_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, week)
);

create table if not exists survey_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  feedback text not null check (char_length(btrim(feedback)) between 1 and 2000),
  category text not null default 'feedback' check (category in ('feedback', 'help', 'problem', 'idea')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolution_email_sent_at timestamptz
);

-- Indexes
create index if not exists idx_activity_user on activity_entries(user_id);
create index if not exists idx_activity_date on activity_entries(entry_date);
create index if not exists idx_checkins_user on wellness_checkins(user_id);
create index if not exists idx_profiles_team on profiles(team_id);

-- Row Level Security
alter table profiles enable row level security;
alter table teams enable row level security;
alter table activity_entries enable row level security;
alter table wellness_checkins enable row level security;
alter table survey_responses enable row level security;
alter table participant_acknowledgements enable row level security;

create or replace function has_current_disclaimer_acknowledgement()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participant_acknowledgements a
    where a.user_id = auth.uid()
      and a.disclaimer_version = '2026-10-04-v1'
      and a.health_risk_accepted_at is not null
      and a.privacy_accepted_at is not null
  );
$$;

create or replace function accept_participant_disclaimer(p_version text)
returns table (disclaimer_version text, health_risk_accepted_at timestamptz, privacy_accepted_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;
  if p_version <> '2026-10-04-v1' then
    raise exception using errcode = '22023', message = 'The participant disclaimer has changed. Refresh and review the current version.';
  end if;
  insert into public.participant_acknowledgements (
    user_id, disclaimer_version, health_risk_accepted_at, privacy_accepted_at, created_at, updated_at
  )
  values (auth.uid(), p_version, now(), now(), now(), now())
  on conflict (user_id) do update
  set disclaimer_version = excluded.disclaimer_version,
      health_risk_accepted_at = excluded.health_risk_accepted_at,
      privacy_accepted_at = excluded.privacy_accepted_at,
      updated_at = excluded.updated_at;
  return query
  select a.disclaimer_version, a.health_risk_accepted_at, a.privacy_accepted_at
  from public.participant_acknowledgements a
  where a.user_id = auth.uid();
end;
$$;

-- Profile read/insert policies are defined with the secure team-management functions below.
-- Users update their own non-privileged profile fields.
create policy "profiles_update_own" on profiles for update
using (auth.uid() = id) with check (auth.uid() = id);

create policy "acknowledgements_select_own" on participant_acknowledgements
for select to authenticated using (auth.uid() = user_id);
revoke all on table participant_acknowledgements from public, anon, authenticated;
grant select on table participant_acknowledgements to authenticated;
revoke all on function has_current_disclaimer_acknowledgement() from public, anon, authenticated;
revoke all on function accept_participant_disclaimer(text) from public, anon, authenticated;
grant execute on function has_current_disclaimer_acknowledgement() to authenticated;
grant execute on function accept_participant_disclaimer(text) to authenticated;

-- Teams: discoverable after sign-in; mutations are restricted below to RPCs
create policy "teams_read_authenticated" on teams for select to authenticated using (true);
create policy "teams_insert_auth" on teams for insert with check (auth.uid() is not null);

-- Activity read policies are defined with the secure helper functions below.
create policy "activity_insert_own" on activity_entries for insert
with check (auth.uid() = user_id and has_current_disclaimer_acknowledgement());
create policy "activity_update_own" on activity_entries for update using (auth.uid() = user_id);
create policy "activity_delete_own" on activity_entries for delete using (auth.uid() = user_id);

-- Check-in read policies are defined with the secure helper functions below.
create policy "checkins_insert_own" on wellness_checkins for insert
with check (auth.uid() = user_id and has_current_disclaimer_acknowledgement());
create policy "checkins_delete_own" on wellness_checkins for delete using (auth.uid() = user_id);

-- Survey: write own, read own (admins read via service role / export)
create policy "survey_insert_own" on survey_responses for insert with check (auth.uid() = user_id);
create policy "survey_read_own" on survey_responses for select using (auth.uid() = user_id);

-- Transactional, irreversible team-management rules.
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

-- Organizer accounts (see migration-exclude-organizer-accounts.sql for the
-- standings views and prize draw filters that use these flags).
alter table public.profiles add column if not exists exclude_from_prizes boolean not null default false;
alter table public.profiles add column if not exists exclude_from_standings boolean not null default false;


-- Solo Week 1 joining exception.
-- Let a solo participant join one existing team during Week 1 even after
-- their first entry. Creating, leaving, deleting, and switching remain locked.

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

-- Activity accuracy audit: daily activity limit, private review log, and
-- administrator audit-queue RPCs. Safe to re-run.
--
-- Rules
--   * A participant can log at most 240 activity minutes per calendar day.
--   * Existing entries above the limit are kept; they can only be reduced.
--   * Days above 240 minutes, or with one entry above 180 minutes, appear in
--     the administrator audit queue until reviewed.
--   * Administrators can approve a day or reduce an entry. Every decision is
--     written to a private review log.

create or replace function public.enforce_daily_activity_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit constant integer := 240;
  v_other integer;
begin
  if new.minutes is null or new.entry_date is null or new.user_id is null then
    return new;
  end if;

  -- Same participant row lock as the first-entry/team-change trigger, so two
  -- concurrent entries cannot both pass the daily check.
  perform 1 from public.profiles p where p.id = new.user_id for update;

  select coalesce(sum(a.minutes), 0)::integer
  into v_other
  from public.activity_entries a
  where a.user_id = new.user_id
    and a.entry_date = new.entry_date
    and a.id is distinct from new.id;

  if v_other + new.minutes <= v_limit then
    return new;
  end if;

  -- Reducing an existing entry on the same day is always allowed, so entries
  -- logged before the limit existed can still be corrected downward.
  if tg_op = 'UPDATE'
     and new.user_id = old.user_id
     and new.entry_date = old.entry_date
     and new.minutes <= old.minutes then
    return new;
  end if;

  raise exception 'Daily activity limit reached: % minutes left for %.',
    greatest(0, v_limit - v_other), new.entry_date
    using errcode = '23514';
end;
$$;

drop trigger if exists enforce_daily_activity_limit on public.activity_entries;
create trigger enforce_daily_activity_limit
before insert or update of minutes, entry_date, user_id on public.activity_entries
for each row execute function public.enforce_daily_activity_limit();

revoke all on function public.enforce_daily_activity_limit() from public, anon, authenticated;

create table if not exists public.activity_audit_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entry_date date not null,
  decision text not null check (decision in ('approved', 'reduced')),
  entry_id uuid,
  minutes_before integer,
  minutes_after integer,
  day_minutes integer not null,
  entry_count integer not null,
  note text check (note is null or char_length(note) <= 500),
  reviewed_by uuid not null,
  created_at timestamptz not null default clock_timestamp()
);

-- clock_timestamp() keeps decisions made in one transaction in order.
alter table public.activity_audit_reviews alter column created_at set default clock_timestamp();

create index if not exists idx_activity_audit_reviews_day
on public.activity_audit_reviews (user_id, entry_date, created_at desc);

alter table public.activity_audit_reviews enable row level security;
revoke all on public.activity_audit_reviews from public, anon, authenticated;

create or replace function public.admin_activity_audit_queue()
returns table (
  user_id uuid,
  participant_name text,
  first_name text,
  email text,
  team_name text,
  entry_date date,
  day_minutes integer,
  entry_count integer,
  max_entry_minutes integer,
  entries jsonb,
  reviewed boolean,
  last_review jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_current_user_admin() then
    raise exception using errcode = '42501', message = 'Only administrators can review activity audits.';
  end if;

  return query
  with days as (
    select
      a.user_id,
      a.entry_date,
      sum(a.minutes)::integer as day_minutes,
      count(*)::integer as entry_count,
      max(a.minutes)::integer as max_entry_minutes,
      jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'activity', a.activity,
          'minutes', a.minutes,
          'created_at', a.created_at
        )
        order by a.minutes desc, a.created_at
      ) as entries
    from public.activity_entries a
    group by a.user_id, a.entry_date
  )
  select
    d.user_id,
    p.full_name,
    split_part(btrim(p.full_name), ' ', 1),
    u.email::text,
    t.name,
    d.entry_date,
    d.day_minutes,
    d.entry_count,
    d.max_entry_minutes,
    d.entries,
    coalesce(r.day_minutes = d.day_minutes and r.entry_count = d.entry_count, false),
    case when r.id is null then null else jsonb_build_object(
      'decision', r.decision,
      'note', r.note,
      'day_minutes', r.day_minutes,
      'minutes_before', r.minutes_before,
      'minutes_after', r.minutes_after,
      'created_at', r.created_at
    ) end
  from days d
  join public.profiles p on p.id = d.user_id
  left join auth.users u on u.id = d.user_id
  left join public.teams t on t.id = p.team_id
  left join lateral (
    select rv.*
    from public.activity_audit_reviews rv
    where rv.user_id = d.user_id and rv.entry_date = d.entry_date
    order by rv.created_at desc
    limit 1
  ) r on true
  where d.day_minutes > 240 or d.max_entry_minutes > 180
  order by 11, d.day_minutes desc, d.entry_date, p.full_name;
end;
$$;

create or replace function public.admin_mark_activity_day_reviewed(
  p_user uuid,
  p_date date,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day_minutes integer;
  v_entry_count integer;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_current_user_admin() then
    raise exception using errcode = '42501', message = 'Only administrators can review activity audits.';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception using errcode = '23514', message = 'Review notes must be 500 characters or fewer.';
  end if;

  perform 1 from public.profiles p where p.id = p_user for update;
  select coalesce(sum(a.minutes), 0)::integer, count(*)::integer
  into v_day_minutes, v_entry_count
  from public.activity_entries a
  where a.user_id = p_user and a.entry_date = p_date;

  if v_entry_count = 0 then
    raise exception using errcode = '23514', message = 'No activity was found for that participant and date.';
  end if;

  insert into public.activity_audit_reviews
    (user_id, entry_date, decision, day_minutes, entry_count, note, reviewed_by)
  values
    (p_user, p_date, 'approved', v_day_minutes, v_entry_count, v_note, auth.uid());

  return jsonb_build_object('decision', 'approved', 'day_minutes', v_day_minutes, 'entry_count', v_entry_count);
end;
$$;

create or replace function public.admin_reduce_activity_entry(
  p_entry uuid,
  p_minutes integer,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_entry public.activity_entries%rowtype;
  v_day_minutes integer;
  v_entry_count integer;
  v_total_points integer;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_current_user_admin() then
    raise exception using errcode = '42501', message = 'Only administrators can review activity audits.';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception using errcode = '23514', message = 'Review notes must be 500 characters or fewer.';
  end if;

  select a.user_id into v_user from public.activity_entries a where a.id = p_entry;
  if v_user is null then
    raise exception using errcode = '23514', message = 'That activity entry no longer exists.';
  end if;

  -- Lock order matches participant entry writes: profile first, then entry.
  perform 1 from public.profiles p where p.id = v_user for update;
  select * into v_entry from public.activity_entries a where a.id = p_entry for update;
  if not found or v_entry.user_id is distinct from v_user then
    raise exception using errcode = '40001', message = 'That activity entry changed. Refresh and try again.';
  end if;

  if p_minutes is null or p_minutes < 1 or p_minutes >= v_entry.minutes then
    raise exception using errcode = '23514', message = 'An audit adjustment must reduce the entry to at least 1 minute.';
  end if;

  update public.activity_entries set minutes = p_minutes where id = p_entry;

  select coalesce(sum(a.minutes), 0)::integer, count(*)::integer
  into v_day_minutes, v_entry_count
  from public.activity_entries a
  where a.user_id = v_user and a.entry_date = v_entry.entry_date;

  -- Remove point-milestone badges the corrected total no longer reaches.
  select
    coalesce((select sum(a.points) from public.activity_entries a where a.user_id = v_user), 0)::integer
    + coalesce((select sum(c.points) from public.wellness_checkins c where c.user_id = v_user), 0)::integer
  into v_total_points;

  delete from public.user_badges ub
  using public.badges b
  where ub.badge_id = b.id
    and ub.user_id = v_user
    and b.category = 'milestone'
    and b.trigger_type = 'points'
    and b.trigger_value > v_total_points;

  insert into public.activity_audit_reviews
    (user_id, entry_date, decision, entry_id, minutes_before, minutes_after,
     day_minutes, entry_count, note, reviewed_by)
  values
    (v_user, v_entry.entry_date, 'reduced', p_entry, v_entry.minutes, p_minutes,
     v_day_minutes, v_entry_count, v_note, auth.uid());

  return jsonb_build_object(
    'decision', 'reduced',
    'minutes_before', v_entry.minutes,
    'minutes_after', p_minutes,
    'day_minutes', v_day_minutes,
    'total_points', v_total_points
  );
end;
$$;

revoke all on function public.admin_activity_audit_queue() from public, anon, authenticated;
revoke all on function public.admin_mark_activity_day_reviewed(uuid, date, text) from public, anon, authenticated;
revoke all on function public.admin_reduce_activity_entry(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.admin_activity_audit_queue() to authenticated;
grant execute on function public.admin_mark_activity_day_reviewed(uuid, date, text) to authenticated;
grant execute on function public.admin_reduce_activity_entry(uuid, integer, text) to authenticated;
