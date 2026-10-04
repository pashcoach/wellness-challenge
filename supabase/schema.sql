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

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique default gen_join_code(),
  created_by uuid references profiles(id) on delete set null,
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
  user_id uuid not null references profiles(id) on delete cascade unique,
  feedback text not null,
  created_at timestamptz not null default now()
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

-- Profiles: everyone can read basic profile info (for leaderboards), users update their own
create policy "profiles_read_all" on profiles for select using (true);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

create policy "acknowledgements_select_own" on participant_acknowledgements
for select to authenticated using (auth.uid() = user_id);
revoke all on table participant_acknowledgements from public, anon, authenticated;
grant select on table participant_acknowledgements to authenticated;
revoke all on function has_current_disclaimer_acknowledgement() from public, anon, authenticated;
revoke all on function accept_participant_disclaimer(text) from public, anon, authenticated;
grant execute on function has_current_disclaimer_acknowledgement() to authenticated;
grant execute on function accept_participant_disclaimer(text) to authenticated;

-- Teams: readable by all, insert by authenticated, update by creator
create policy "teams_read_all" on teams for select using (true);
create policy "teams_insert_auth" on teams for insert with check (auth.uid() is not null);

-- Activity entries: read all (leaderboards), write own
create policy "activity_read_all" on activity_entries for select using (true);
create policy "activity_insert_own" on activity_entries for insert
with check (auth.uid() = user_id and has_current_disclaimer_acknowledgement());
create policy "activity_update_own" on activity_entries for update using (auth.uid() = user_id);
create policy "activity_delete_own" on activity_entries for delete using (auth.uid() = user_id);

-- Wellness check-ins: read all, write own
create policy "checkins_read_all" on wellness_checkins for select using (true);
create policy "checkins_insert_own" on wellness_checkins for insert
with check (auth.uid() = user_id and has_current_disclaimer_acknowledgement());
create policy "checkins_delete_own" on wellness_checkins for delete using (auth.uid() = user_id);

-- Survey: write own, read own (admins read via service role / export)
create policy "survey_insert_own" on survey_responses for insert with check (auth.uid() = user_id);
create policy "survey_read_own" on survey_responses for select using (auth.uid() = user_id);

-- Helper: generate a short team join code
create or replace function gen_join_code() returns text language sql as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;
