-- Badge repair — correct totals, weekday streaks, distinct-day awards, and writes

begin;

-- Pure helper makes weekday streak behavior deterministic and testable. Weekend
-- dates are ignored; Friday followed by Monday is consecutive.
create or replace function public.longest_weekday_streak(p_dates date[])
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_date date;
  v_previous date;
  v_current integer := 0;
  v_longest integer := 0;
begin
  for v_date in
    select distinct dates.value
    from unnest(coalesce(p_dates, array[]::date[])) as dates(value)
    where extract(isodow from dates.value) between 1 and 5
    order by dates.value
  loop
    if v_previous is null then
      v_current := 1;
    elsif v_date = v_previous + 1
      or (extract(isodow from v_previous) = 5 and v_date = v_previous + 3) then
      v_current := v_current + 1;
    else
      v_current := 1;
    end if;
    v_longest := greatest(v_longest, v_current);
    v_previous := v_date;
  end loop;
  return v_longest;
end;
$$;

create or replace function public.longest_user_activity_streak(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.longest_weekday_streak(
    coalesce(
      (select array_agg(distinct a.entry_date) from public.activity_entries a where a.user_id = p_user_id),
      array[]::date[]
    )
  );
$$;

create or replace function public.award_badges(p_user_id uuid)
returns setof public.user_badges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_points integer;
  v_streak_days integer;
  v_checkin_count integer;
  v_night_count integer;
  v_early_count integer;
  v_badge record;
begin
  -- Sum each source independently. Joining activities to check-ins would
  -- multiply rows and inflate totals.
  select
    coalesce((select sum(a.points) from public.activity_entries a where a.user_id = p_user_id), 0)
    + coalesce((select sum(c.points) from public.wellness_checkins c where c.user_id = p_user_id), 0)
  into v_total_points;

  select count(distinct c.week) into v_checkin_count
  from public.wellness_checkins c
  where c.user_id = p_user_id;

  v_streak_days := public.longest_user_activity_streak(p_user_id);

  select count(distinct (a.created_at at time zone 'America/Regina')::date)
  into v_night_count
  from public.activity_entries a
  where a.user_id = p_user_id
    and extract(hour from a.created_at at time zone 'America/Regina') >= 21;

  select count(distinct (a.created_at at time zone 'America/Regina')::date)
  into v_early_count
  from public.activity_entries a
  where a.user_id = p_user_id
    and extract(hour from a.created_at at time zone 'America/Regina') < 7;

  for v_badge in
    select b.id, b.trigger_value
    from public.badges b
    where b.category = 'milestone' and b.trigger_type = 'points'
    order by b.trigger_value
  loop
    if v_total_points >= v_badge.trigger_value then
      insert into public.user_badges (user_id, badge_id)
      values (p_user_id, v_badge.id)
      on conflict do nothing;
    end if;
  end loop;

  for v_badge in
    select b.id, b.trigger_value
    from public.badges b
    where b.category = 'streak' and b.trigger_type = 'streak_days'
    order by b.trigger_value
  loop
    if v_streak_days >= v_badge.trigger_value then
      insert into public.user_badges (user_id, badge_id)
      values (p_user_id, v_badge.id)
      on conflict do nothing;
    end if;
  end loop;

  if v_checkin_count >= 4 then
    insert into public.user_badges (user_id, badge_id)
    select p_user_id, b.id from public.badges b where b.key = 'all_rounder'
    on conflict do nothing;
  end if;

  if v_night_count >= 5 then
    insert into public.user_badges (user_id, badge_id)
    select p_user_id, b.id from public.badges b where b.key = 'night_owl'
    on conflict do nothing;
  end if;

  if v_early_count >= 5 then
    insert into public.user_badges (user_id, badge_id)
    select p_user_id, b.id from public.badges b where b.key = 'early_bird'
    on conflict do nothing;
  end if;

  return query
  select ub.*
  from public.user_badges ub
  where ub.user_id = p_user_id
  order by ub.awarded_at;
end;
$$;

create or replace function public.trigger_award_badges_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_badges(new.user_id);
  return new;
end;
$$;

create or replace function public.trigger_award_badges_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_badges(new.user_id);
  return new;
end;
$$;

-- Earned badges can be created only by the security-definer award function.
drop policy if exists "user_badges_insert_function" on public.user_badges;
revoke insert, update, delete on table public.user_badges from anon, authenticated;

revoke all on function public.longest_weekday_streak(date[]) from public, anon, authenticated;
revoke all on function public.longest_user_activity_streak(uuid) from public, anon, authenticated;
revoke all on function public.award_badges(uuid) from public, anon, authenticated;
revoke all on function public.trigger_award_badges_activity() from public, anon, authenticated;
revoke all on function public.trigger_award_badges_checkin() from public, anon, authenticated;

-- Keep database descriptions aligned with the app's weekday-based streak rule.
update public.badges set description = 'Log activity 3 weekdays in a row' where key = 'on_fire';
update public.badges set description = 'Log activity 5 weekdays in a row' where key = 'blazing';
update public.badges set description = 'Log activity 10 weekdays in a row' where key = 'inferno';

-- Deterministic streak regression tests.
do $$
begin
  if public.longest_weekday_streak(array[]::date[]) <> 0 then
    raise exception 'Badge self-test failed: empty streak';
  end if;
  if public.longest_weekday_streak(array[
    date '2026-10-09', date '2026-10-10', date '2026-10-12', date '2026-10-13'
  ]) <> 3 then
    raise exception 'Badge self-test failed: Friday-to-Monday streak';
  end if;
  if public.longest_weekday_streak(array[
    date '2026-10-05', date '2026-10-05', date '2026-10-07',
    date '2026-10-08', date '2026-10-09'
  ]) <> 3 then
    raise exception 'Badge self-test failed: duplicates or reset';
  end if;
  if has_table_privilege('authenticated', 'public.user_badges', 'INSERT') then
    raise exception 'Badge self-test failed: authenticated can insert awards';
  end if;
end;
$$;

commit;
