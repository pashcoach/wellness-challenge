-- Migration: leaderboard_aggregate view
-- Run this in the Supabase SQL editor after schema.sql.
-- Pre-computes leaderboard data server-side so the client fetches
-- one row per participant instead of 4 unfiltered tables.

drop view if exists leaderboard_totals;

create view leaderboard_totals as
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
from profiles p
left join teams t on t.id = p.team_id
left join (
  select user_id, points, week from activity_entries
  union all
  select user_id, points, week from wellness_checkins
) e on e.user_id = p.id
group by p.id, t.name, p.team_id;

grant select on leaderboard_totals to authenticated;

-- Helper: team standings (avg per member)
drop view if exists team_standings;

create view team_standings as
select
  t.id,
  t.name,
  count(p.id) as members,
  coalesce(round(sum(lt.total)::numeric / nullif(count(p.id), 0)), 0)::int as avg
from teams t
left join profiles p on p.team_id = t.id
left join leaderboard_totals lt on lt.id = p.id
group by t.id, t.name;

grant select on team_standings to authenticated;
