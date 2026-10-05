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
