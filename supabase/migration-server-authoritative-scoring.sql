-- Production security hardening — step 4: server-authoritative scoring
--
-- Activity points and challenge weeks are derived by PostgreSQL. Wellness
-- check-in points, dates, and pillars are also normalized server-side.
-- Client-supplied scoring fields are ignored and replaced with trusted values.

begin;

create or replace function public.challenge_week_for_date(p_date date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_date between date '2026-10-05' and date '2026-10-30'
      then least(4, 1 + ((p_date - date '2026-10-05') / 7))
    else null
  end;
$$;

create or replace function public.challenge_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (current_timestamp at time zone 'America/Regina')::date;
$$;

create or replace function public.normalize_activity_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week integer;
begin
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception using errcode = '42501', message = 'The activity owner cannot be changed.';
  end if;

  new.activity := btrim(new.activity);
  if new.activity is null or new.activity = '' then
    raise exception using errcode = '23514', message = 'Activity is required.';
  end if;
  if char_length(new.activity) > 100 then
    raise exception using errcode = '23514', message = 'Activity must be 100 characters or fewer.';
  end if;
  if new.minutes is null or new.minutes < 1 or new.minutes > 1440 then
    raise exception using errcode = '23514', message = 'Minutes must be between 1 and 1440.';
  end if;

  v_week := public.challenge_week_for_date(new.entry_date);
  if v_week is null then
    raise exception using errcode = '23514', message = 'Activity date is outside the challenge.';
  end if;
  if new.entry_date > public.challenge_today() then
    raise exception using errcode = '23514', message = 'Future activities cannot be logged.';
  end if;

  -- Ten minutes earns ten points, so the authoritative value equals minutes.
  new.points := new.minutes;
  new.week := v_week;
  return new;
end;
$$;

create or replace function public.normalize_wellness_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.challenge_today();
  v_current_week integer;
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception using errcode = '42501', message = 'The check-in owner cannot be changed.';
    end if;
    -- Existing check-ins may only change their optional comment through the
    -- app. Preserve every field that affects scoring or eligibility.
    new.week := old.week;
    new.pillar := old.pillar;
    new.entry_date := old.entry_date;
  else
    v_current_week := public.challenge_week_for_date(v_today);
    if v_current_week is null then
      raise exception using errcode = '23514', message = 'Wellness check-ins are closed.';
    end if;
    if new.week is null or new.week < 1 or new.week > v_current_week then
      raise exception using errcode = '23514', message = 'That wellness week is not open.';
    end if;
    new.entry_date := v_today;
  end if;

  new.pillar := case new.week
    when 1 then 'physical'
    when 2 then 'psychological'
    when 3 then 'financial'
    when 4 then 'social'
  end;
  new.points := 20;

  if new.comment is not null then
    new.comment := nullif(btrim(new.comment), '');
    if char_length(new.comment) > 1000 then
      raise exception using errcode = '23514', message = 'Check-in comments must be 1000 characters or fewer.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.challenge_week_for_date(date) from public, anon;
revoke all on function public.challenge_today() from public, anon;
revoke all on function public.normalize_activity_entry() from public, anon, authenticated;
revoke all on function public.normalize_wellness_checkin() from public, anon, authenticated;
grant execute on function public.challenge_week_for_date(date) to authenticated;
grant execute on function public.challenge_today() to authenticated;

drop trigger if exists normalize_activity_entry_before_write on public.activity_entries;
create trigger normalize_activity_entry_before_write
before insert or update on public.activity_entries
for each row execute function public.normalize_activity_entry();

drop trigger if exists normalize_wellness_checkin_before_write on public.wellness_checkins;
create trigger normalize_wellness_checkin_before_write
before insert or update on public.wellness_checkins
for each row execute function public.normalize_wellness_checkin();

-- Make own-row checks explicit for updates as well as inserts.
drop policy if exists "activity_insert_own" on public.activity_entries;
create policy "activity_insert_own"
on public.activity_entries
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "activity_update_own" on public.activity_entries;
create policy "activity_update_own"
on public.activity_entries
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "activity_delete_own" on public.activity_entries;
create policy "activity_delete_own"
on public.activity_entries
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "checkins_insert_own" on public.wellness_checkins;
create policy "checkins_insert_own"
on public.wellness_checkins
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "checkins_update_own" on public.wellness_checkins;
create policy "checkins_update_own"
on public.wellness_checkins
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "checkins_delete_own" on public.wellness_checkins;
create policy "checkins_delete_own"
on public.wellness_checkins
for delete
to authenticated
using (user_id = auth.uid());

-- Deterministic migration tests for every challenge boundary.
do $$
begin
  if public.challenge_week_for_date(date '2026-10-04') is not null
    or public.challenge_week_for_date(date '2026-10-05') <> 1
    or public.challenge_week_for_date(date '2026-10-11') <> 1
    or public.challenge_week_for_date(date '2026-10-12') <> 2
    or public.challenge_week_for_date(date '2026-10-18') <> 2
    or public.challenge_week_for_date(date '2026-10-19') <> 3
    or public.challenge_week_for_date(date '2026-10-25') <> 3
    or public.challenge_week_for_date(date '2026-10-26') <> 4
    or public.challenge_week_for_date(date '2026-10-30') <> 4
    or public.challenge_week_for_date(date '2026-10-31') is not null then
    raise exception 'Challenge week boundary self-test failed';
  end if;
end;
$$;

commit;
