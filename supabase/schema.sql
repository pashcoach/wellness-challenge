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

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique,
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

-- Profiles: everyone can read basic profile info (for leaderboards), users update their own
create policy "profiles_read_all" on profiles for select using (true);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- Teams: readable by all, insert by authenticated, update by creator
create policy "teams_read_all" on teams for select using (true);
create policy "teams_insert_auth" on teams for insert with check (auth.uid() is not null);

-- Activity entries: read all (leaderboards), write own
create policy "activity_read_all" on activity_entries for select using (true);
create policy "activity_insert_own" on activity_entries for insert with check (auth.uid() = user_id);
create policy "activity_update_own" on activity_entries for update using (auth.uid() = user_id);
create policy "activity_delete_own" on activity_entries for delete using (auth.uid() = user_id);

-- Wellness check-ins: read all, write own
create policy "checkins_read_all" on wellness_checkins for select using (true);
create policy "checkins_insert_own" on wellness_checkins for insert with check (auth.uid() = user_id);
create policy "checkins_delete_own" on wellness_checkins for delete using (auth.uid() = user_id);

-- Survey: write own, read own (admins read via service role / export)
create policy "survey_insert_own" on survey_responses for insert with check (auth.uid() = user_id);
create policy "survey_read_own" on survey_responses for select using (auth.uid() = user_id);

-- Helper: generate a short team join code
create or replace function gen_join_code() returns text language sql as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;
