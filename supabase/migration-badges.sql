-- Badge / Achievement System — v1.4
-- Run this in the Supabase SQL editor after the main schema.

-- 1. Badge catalog
create table if not exists badges (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  icon text not null,
  description text not null,
  category text not null check (category in ('milestone','streak','social','hidden')),
  trigger_type text not null check (trigger_type in ('points','streak_days','checkins','manual','all_checkins','time_of_day')),
  trigger_value integer
);

-- 2. User-earned badges
create table if not exists user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  badge_id uuid not null references badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

-- 3. Seed badge definitions
insert into badges (key, name, icon, description, category, trigger_type, trigger_value) values
  ('bronze', 'Bronze', '🥉', 'Log your first activity', 'milestone', 'points', 1),
  ('silver', 'Silver', '🥈', 'Earn 140 lifetime points', 'milestone', 'points', 140),
  ('gold', 'Gold', '🥇', 'Earn 280 lifetime points', 'milestone', 'points', 280),
  ('platinum', 'Platinum', '💎', 'Earn 420 lifetime points', 'milestone', 'points', 420),
  ('champion', 'Champion', '🏆', 'Earn 560 total points', 'milestone', 'points', 560),
  ('overachiever', 'Overachiever', '⭐', 'Earn 700+ lifetime points', 'milestone', 'points', 700),
  ('on_fire', 'On Fire', '🔥', 'Log activity 3 days in a row', 'streak', 'streak_days', 3),
  ('blazing', 'Blazing', '🔥🔥', 'Log activity 5 days in a row', 'streak', 'streak_days', 5),
  ('inferno', 'Inferno', '🔥🔥🔥', 'Log activity 10 days in a row', 'streak', 'streak_days', 10),
  ('all_rounder', 'All-Rounder', '📝', 'Complete all 4 weekly wellness check-ins', 'hidden', 'all_checkins', 4),
  ('night_owl', 'Night Owl', '🦉', 'Log activity after 9pm on 5+ different days', 'hidden', 'time_of_day', 5),
  ('early_bird', 'Early Bird', '🌅', 'Log activity before 7am on 5+ different days', 'hidden', 'time_of_day', 5)
on conflict (key) do nothing;

-- 4. Award function — called after every activity/check-in insert
create or replace function award_badges(p_user_id uuid)
returns setof user_badges
language plpgsql
security definer
as $$
declare
  v_total_points integer;
  v_latest_two_weeks record;
  v_streak_days integer;
  v_checkin_count integer;
  v_night_count integer;
  v_early_count integer;
  v_badge record;
begin
  -- Calculate total points from activities + checkins
  select coalesce(sum(a.points), 0) + coalesce(sum(c.points), 0)
  into v_total_points
  from profiles p
  left join activity_entries a on a.user_id = p.id
  left join wellness_checkins c on c.user_id = p.id
  where p.id = p_user_id;

  -- Count completed check-ins
  select count(*) into v_checkin_count
  from wellness_checkins where user_id = p_user_id;

  -- Count night owl entries (created_at hour >= 21)
  select count(*) into v_night_count
  from activity_entries
  where user_id = p_user_id
    and extract(hour from created_at) >= 21;

  -- Count early bird entries (created_at hour < 7)
  select count(*) into v_early_count
  from activity_entries
  where user_id = p_user_id
    and extract(hour from created_at) < 7;

  -- Award milestone badges
  for v_badge in select * from badges where category = 'milestone' and trigger_type = 'points' order by trigger_value loop
    if v_total_points >= v_badge.trigger_value then
      insert into user_badges (user_id, badge_id) values (p_user_id, v_badge.id)
      on conflict do nothing;
    end if;
  end loop;

  -- Award all-rounder
  if v_checkin_count >= 4 then
    select id into v_badge from badges where key = 'all_rounder';
    insert into user_badges (user_id, badge_id) values (p_user_id, v_badge.id)
    on conflict do nothing;
  end if;

  -- Award night owl
  if v_night_count >= 5 then
    select id into v_badge from badges where key = 'night_owl';
    insert into user_badges (user_id, badge_id) values (p_user_id, v_badge.id)
    on conflict do nothing;
  end if;

  -- Award early bird
  if v_early_count >= 5 then
    select id into v_badge from badges where key = 'early_bird';
    insert into user_badges (user_id, badge_id) values (p_user_id, v_badge.id)
    on conflict do nothing;
  end if;

  -- Return newly awarded badges
  return query
  select ub.* from user_badges ub
  where ub.user_id = p_user_id
    and ub.awarded_at >= now() - interval '5 seconds';
end;
$$;

-- 5. Trigger: auto-award badges after activity insert
create or replace function trigger_award_badges_activity()
returns trigger
language plpgsql
security definer
as $$
begin
  perform award_badges(new.user_id);
  return new;
end;
$$;

drop trigger if exists award_badges_on_activity on activity_entries;
create trigger award_badges_on_activity
  after insert on activity_entries
  for each row execute function trigger_award_badges_activity();

-- Trigger: auto-award badges after check-in insert
create or replace function trigger_award_badges_checkin()
returns trigger
language plpgsql
security definer
as $$
begin
  perform award_badges(new.user_id);
  return new;
end;
$$;

drop trigger if exists award_badges_on_checkin on wellness_checkins;
create trigger award_badges_on_checkin
  after insert on wellness_checkins
  for each row execute function trigger_award_badges_checkin();

-- Helper: view to get badges with user info
create or replace view profile_badges as
select
  p.id as user_id,
  p.full_name,
  json_agg(json_build_object(
    'key', b.key,
    'name', b.name,
    'icon', b.icon,
    'description', b.description,
    'category', b.category,
    'awarded_at', ub.awarded_at
  ) order by ub.awarded_at) as badges
from profiles p
left join user_badges ub on ub.user_id = p.id
left join badges b on b.id = ub.badge_id
group by p.id, p.full_name;

-- Enable RLS on new tables
alter table badges enable row level security;
alter table user_badges enable row level security;

-- Badges: everyone can read
create policy "badges_read_all" on badges for select using (true);

-- User badges: everyone can read, only the award function can insert
create policy "user_badges_read_all" on user_badges for select using (true);
create policy "user_badges_insert_function" on user_badges for insert with check (true);