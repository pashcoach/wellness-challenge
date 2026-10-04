-- Organizer accounts: keep the challenge organizer out of prize draws, and
-- keep the administrator-only account out of standings as well.
--
--   exclude_from_prizes    -> skipped by every weekly, grand, and team draw
--   exclude_from_standings -> hidden from leaderboards, team averages, and
--                             admin participation stats
--
-- Participants cannot change either flag: the authenticated role only has
-- column-level insert/update privileges on the safe profile fields.

begin;

alter table public.profiles add column if not exists exclude_from_prizes boolean not null default false;
alter table public.profiles add column if not exists exclude_from_standings boolean not null default false;

do $$
begin
  if has_column_privilege('authenticated', 'public.profiles', 'exclude_from_prizes', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'exclude_from_prizes', 'INSERT')
     or has_column_privilege('authenticated', 'public.profiles', 'exclude_from_standings', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'exclude_from_standings', 'INSERT') then
    raise exception 'Organizer exclusion flags must not be participant-writable.';
  end if;
end;
$$;

-- Flag the two organizer accounts; fail if either does not match exactly once.
do $$
declare
  v_count integer;
begin
  update public.profiles p
  set exclude_from_prizes = true, exclude_from_standings = true
  where p.full_name = 'P Ash' and p.is_admin;
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'Expected exactly 1 admin account named P Ash, found %.', v_count;
  end if;

  update public.profiles p
  set exclude_from_prizes = true
  where p.full_name = 'Patrick Ash' and not p.is_admin;
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'Expected exactly 1 participant account named Patrick Ash, found %.', v_count;
  end if;
end;
$$;

-- Standings ------------------------------------------------------------------

create or replace view public.leaderboard_totals as
select
  p.id,
  coalesce(nullif(trim(p.username), ''),
    split_part(p.full_name, ' ', 1) || ' ' ||
    left(split_part(p.full_name, ' ', array_length(string_to_array(p.full_name, ' '), 1)), 1) || '.'
  ) as display_name,
  t.name as team_name,
  p.team_id,
  coalesce(sum(e.points) filter (where e.week = 1), 0) as w1,
  coalesce(sum(e.points) filter (where e.week = 2), 0) as w2,
  coalesce(sum(e.points) filter (where e.week = 3), 0) as w3,
  coalesce(sum(e.points) filter (where e.week = 4), 0) as w4,
  coalesce(sum(e.points), 0) as total
from public.profiles p
left join public.teams t on t.id = p.team_id
left join (
  select user_id, points, week from public.activity_entries
  union all
  select user_id, points, week from public.wellness_checkins
) e on e.user_id = p.id
where not p.exclude_from_standings
group by p.id, t.name, p.team_id;

create or replace view public.team_standings as
select
  t.id,
  t.name,
  count(p.id) as members,
  coalesce(round(sum(lt.total)::numeric / nullif(count(p.id), 0)), 0)::int as avg
from public.teams t
left join public.profiles p on p.team_id = t.id and not p.exclude_from_standings
left join public.leaderboard_totals lt on lt.id = p.id
group by t.id, t.name;

-- Prize draws ----------------------------------------------------------------

-- Draw functions run with an empty search_path, so every table reference in
-- this helper must be schema-qualified (unqualified names fail at draw time).
create or replace function public.user_week_points(p_user uuid, p_week integer)
returns integer
language sql
stable
set search_path = ''
as $$
  select
    coalesce((select sum(a.points) from public.activity_entries a where a.user_id = p_user and a.week = p_week), 0)::integer
    + coalesce((select sum(c.points) from public.wellness_checkins c where c.user_id = p_user and c.week = p_week), 0)::integer;
$$;

create or replace function public.run_weekly_draw(p_week integer)
returns table(winner_name text, winner_business_unit text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draw_key text;
  v_user uuid;
  v_eligible integer;
begin
  perform public.require_current_user_admin();

  if p_week not between 1 and 4 then
    raise exception using errcode = '22023', message = 'Week must be between 1 and 4.';
  end if;
  v_draw_key := 'week' || p_week;

  select count(*) into v_eligible
  from public.profiles p
  where public.user_week_points(p.id, p_week) >= 140
    and public.user_has_activity_in_week(p.id, p_week)
    and not p.exclude_from_prizes
    and not exists (
      select 1 from public.draw_results d where d.user_id = p.id
    );

  if v_eligible < 2 then
    raise exception 'Week % needs 2 eligible participants with 140+ points and a logged wellness activity; only % available.', p_week, v_eligible;
  end if;

  begin
    insert into public.draw_runs (draw_key, run_by) values (v_draw_key, auth.uid());
  exception when unique_violation then
    raise exception 'Week % draw has already been run.', p_week;
  end;

  for v_user in
    select p.id
    from public.profiles p
    where public.user_week_points(p.id, p_week) >= 140
      and public.user_has_activity_in_week(p.id, p_week)
      and not p.exclude_from_prizes
      and not exists (
        select 1 from public.draw_results d where d.user_id = p.id
      )
    order by random()
    limit 2
  loop
    insert into public.draw_results (draw_key, user_id) values (v_draw_key, v_user);
    winner_name := (select p.full_name from public.profiles p where p.id = v_user);
    winner_business_unit := (select p.business_unit from public.profiles p where p.id = v_user);
    return next;
  end loop;
end;
$$;

create or replace function public.run_grand_prize_draw()
returns table(winner_name text, winner_business_unit text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_eligible integer;
begin
  perform public.require_current_user_admin();

  select count(*) into v_eligible
  from public.profiles p
  where public.user_week_points(p.id, 1) >= 140
    and public.user_week_points(p.id, 2) >= 140
    and public.user_week_points(p.id, 3) >= 140
    and public.user_week_points(p.id, 4) >= 140
    and public.user_has_activity_in_week(p.id, 1)
    and public.user_has_activity_in_week(p.id, 2)
    and public.user_has_activity_in_week(p.id, 3)
    and public.user_has_activity_in_week(p.id, 4)
    and not p.exclude_from_prizes
    and not exists (
      select 1 from public.draw_results d where d.user_id = p.id
    );

  if v_eligible < 2 then
    raise exception 'Grand prize needs 2 eligible participants with 140+ points and a logged wellness activity in every week; only % available.', v_eligible;
  end if;

  begin
    insert into public.draw_runs (draw_key, run_by) values ('grand', auth.uid());
  exception when unique_violation then
    raise exception 'Grand prize draw has already been run.';
  end;

  for v_user in
    select p.id
    from public.profiles p
    where public.user_week_points(p.id, 1) >= 140
      and public.user_week_points(p.id, 2) >= 140
      and public.user_week_points(p.id, 3) >= 140
      and public.user_week_points(p.id, 4) >= 140
      and public.user_has_activity_in_week(p.id, 1)
      and public.user_has_activity_in_week(p.id, 2)
      and public.user_has_activity_in_week(p.id, 3)
      and public.user_has_activity_in_week(p.id, 4)
      and not p.exclude_from_prizes
      and not exists (
        select 1 from public.draw_results d where d.user_id = p.id
      )
    order by random()
    limit 2
  loop
    insert into public.draw_results (draw_key, user_id) values ('grand', v_user);
    winner_name := (select p.full_name from public.profiles p where p.id = v_user);
    winner_business_unit := (select p.business_unit from public.profiles p where p.id = v_user);
    return next;
  end loop;
end;
$$;

-- A team qualifies for the random lunch draw only through activity logged by
-- prize-eligible members. If the organizer is on a team, that team can still
-- win when its other members are active.
create or replace function public.run_random_team_draw()
returns table(team_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_top_team uuid;
begin
  perform public.require_current_user_admin();

  -- This matches the admin dashboard's top-team ranking. The additional
  -- name/id ordering makes an exact tie deterministic.
  select ts.id into v_top_team
  from public.team_standings ts
  order by ts.avg desc, ts.name asc, ts.id asc
  limit 1;

  select t.id into v_team
  from public.teams t
  where t.id <> v_top_team
    and exists (
      select 1
      from public.profiles p
      join public.activity_entries a on a.user_id = p.id
      where p.team_id = t.id
        and not p.exclude_from_prizes
    )
  order by random()
  limit 1;

  if v_team is null then
    raise exception 'No activity-eligible teams remain after excluding the top team.';
  end if;

  begin
    insert into public.draw_runs (draw_key, run_by) values ('team_random', auth.uid());
  exception when unique_violation then
    raise exception 'Random team draw has already been run.';
  end;

  insert into public.draw_results (draw_key, team_id) values ('team_random', v_team);
  team_name := (select t.name from public.teams t where t.id = v_team);
  return next;
end;
$$;

commit;
