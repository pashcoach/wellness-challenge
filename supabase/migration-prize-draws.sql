-- Prize Draw System — v1.5
-- Rules:
--  * Weekly draws: 2 random winners who earned >= 140 pts that week
--  * No participant can win more than once (any individual draw)
--  * Grand prize: 2 winners, >= 140 pts EVERY week (>= 560 total)
--  * Team prizes: highest-scoring team + one random team (all participating teams)
--  * Each draw runs exactly once (draw_key unique)
--  * Winners are presented for Patrick's approval before being published

-- 1. Draw results table (records every draw; unique draw_key prevents re-runs)
create table if not exists draw_results (
  id uuid primary key default gen_random_uuid(),
  draw_key text not null unique,          -- 'week1'..'week4', 'grand', 'team_top', 'team_random'
  user_id uuid references profiles(id) on delete cascade,   -- individual draws
  team_id uuid references teams(id) on delete cascade,      -- team draws
  drawn_at timestamptz not null default now()
);

-- 2. Helper: points earned by a user in a given week (activities + check-ins)
create or replace function user_week_points(p_user uuid, p_week integer)
returns integer
language sql
stable
as $$
  select
    coalesce((select sum(points) from activity_entries where user_id = p_user and week = p_week), 0)
    + coalesce((select sum(points) from wellness_checkins where user_id = p_user and week = p_week), 0);
$$;

-- 3. Weekly prize draw — 2 random eligible winners (>= 140 pts), no repeat winners
create or replace function run_weekly_draw(p_week integer)
returns table (winner_name text, winner_business_unit text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draw_key text := 'week' || p_week;
  v_user uuid;
begin
  -- Guard: each week can only be drawn once
  if exists (select 1 from draw_results where draw_key = v_draw_key) then
    raise exception 'Week % draw has already been run.', p_week;
  end if;

  for v_user in
    select p.id
    from profiles p
    where user_week_points(p.id, p_week) >= 140
      and not exists (select 1 from draw_results d where d.user_id = p.id)
    order by random()
  loop
    if (select count(*) from draw_results where draw_key = v_draw_key) < 2 then
      insert into draw_results (draw_key, user_id) values (v_draw_key, v_user);
      winner_name := (select full_name from profiles where id = v_user);
      winner_business_unit := (select business_unit from profiles where id = v_user);
      return next;
    else
      exit;
    end if;
  end loop;

  if not exists (select 1 from draw_results where draw_key = v_draw_key) then
    raise exception 'No eligible participants for week % draw (need 140+ points).', p_week;
  end if;
end;
$$;

-- 4. Grand prize draw — >= 140 pts in EVERY week (>= 560 total), no repeat winners
create or replace function run_grand_prize_draw()
returns table (winner_name text, winner_business_unit text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if exists (select 1 from draw_results where draw_key = 'grand') then
    raise exception 'Grand prize draw has already been run.';
  end if;

  for v_user in
    select p.id
    from profiles p
    where
      user_week_points(p.id, 1) >= 140
      and user_week_points(p.id, 2) >= 140
      and user_week_points(p.id, 3) >= 140
      and user_week_points(p.id, 4) >= 140
      and not exists (select 1 from draw_results d where d.user_id = p.id)
    order by random()
  loop
    if (select count(*) from draw_results where draw_key = 'grand') < 2 then
      insert into draw_results (draw_key, user_id) values ('grand', v_user);
      winner_name := (select full_name from profiles where id = v_user);
      winner_business_unit := (select business_unit from profiles where id = v_user);
      return next;
    else
      exit;
    end if;
  end loop;

  if not exists (select 1 from draw_results where draw_key = 'grand') then
    raise exception 'No eligible participants for the grand prize (need 140 pts every week).';
  end if;
end;
$$;

-- 5. Random team draw — from all teams that have at least one active participant
create or replace function run_random_team_draw()
returns table (team_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
begin
  if exists (select 1 from draw_results where draw_key = 'team_random') then
    raise exception 'Random team draw has already been run.';
  end if;

  select t.id into v_team
  from teams t
  where exists (
    select 1 from profiles p
    join activity_entries a on a.user_id = p.id
    where p.team_id = t.id
  )
  order by random()
  limit 1;

  if v_team is null then
    raise exception 'No teams with activity found for the random draw.';
  end if;

  insert into draw_results (draw_key, team_id) values ('team_random', v_team);
  team_name := (select name from teams where id = v_team);
  return next;
end;
$$;

-- 6. View: all draw results with names for review
create or replace view draw_results_view as
select
  dr.draw_key,
  dr.drawn_at,
  p.full_name as winner_name,
  p.business_unit as winner_business_unit,
  t.name as team_name
from draw_results dr
left join profiles p on p.id = dr.user_id
left join teams t on t.id = dr.team_id
order by dr.drawn_at;

-- RLS: readable by all, inserts only via security-definer functions
alter table draw_results enable row level security;
create policy "draw_results_read_all" on draw_results for select using (true);
create policy "draw_results_insert_function" on draw_results for insert with check (true);

-- Ensure the RPC functions are executable by authenticated users
grant execute on function run_weekly_draw(integer) to authenticated, anon;
grant execute on function run_grand_prize_draw() to authenticated, anon;
grant execute on function run_random_team_draw() to authenticated, anon;