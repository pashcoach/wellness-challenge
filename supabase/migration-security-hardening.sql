-- Production security hardening — step 1: least-privilege reads
--
-- Purpose:
--   * Stop anonymous access to participant data.
--   * Limit signed-in participants to their own private records.
--   * Preserve privacy-safe leaderboard access and team features.
--   * Preserve full administrative reporting for verified admins.
--
-- This migration intentionally does not yet harden profile updates, scoring,
-- prize execution, or badge awarding; those are separate reviewed steps.

begin;

-- Security-definer helpers avoid recursive RLS checks when a policy needs to
-- inspect the caller's profile or team. An empty search_path prevents object
-- shadowing; every referenced object is schema-qualified.
create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.shares_team_with(p_other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles me
    join public.profiles them on them.team_id = me.team_id
    where me.id = auth.uid()
      and them.id = p_other_user
      and me.team_id is not null
  );
$$;

revoke all on function public.current_user_is_admin() from public, anon;
revoke all on function public.shares_team_with(uuid) from public, anon;
grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.shares_team_with(uuid) to authenticated;

-- Anonymous visitors authenticate through Supabase Auth; they never need
-- direct table access. RLS remains the second layer for signed-in users.
revoke all on table public.profiles from anon;
revoke all on table public.teams from anon;
revoke all on table public.activity_entries from anon;
revoke all on table public.wellness_checkins from anon;
revoke all on table public.survey_responses from anon;
revoke all on table public.draw_results from anon;
revoke all on table public.badges from anon;
revoke all on table public.user_badges from anon;

-- Explicit signed-in role grants; row policies below still decide which rows
-- each person can access.
grant select, insert, update on table public.profiles to authenticated;
grant select, insert on table public.teams to authenticated;
grant select, insert, update, delete on table public.activity_entries to authenticated;
grant select, insert, update, delete on table public.wellness_checkins to authenticated;
grant select, insert on table public.survey_responses to authenticated;
grant select on table public.draw_results to authenticated;
grant select on table public.badges to authenticated;
grant select on table public.user_badges to authenticated;

-- Profiles contain names and demographics. A participant may read their own
-- row and privacy-safe teammate identities; admins may read all rows.
drop policy if exists "profiles_read_all" on public.profiles;
drop policy if exists "profiles_select_scoped" on public.profiles;
create policy "profiles_select_scoped"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_user_is_admin()
  or public.shares_team_with(id)
);

-- Team names and join codes are visible only after sign-in.
drop policy if exists "teams_read_all" on public.teams;
drop policy if exists "teams_select_authenticated" on public.teams;
create policy "teams_select_authenticated"
on public.teams
for select
to authenticated
using (true);

-- A participant may read their own activity and activity belonging to a
-- current teammate. This preserves the existing team feed without exposing
-- all activity across the organization.
drop policy if exists "activity_read_all" on public.activity_entries;
drop policy if exists "activity_select_scoped" on public.activity_entries;
create policy "activity_select_scoped"
on public.activity_entries
for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_is_admin()
  or public.shares_team_with(user_id)
);

-- Wellness comments and feedback are private to the participant and admins.
drop policy if exists "checkins_read_all" on public.wellness_checkins;
drop policy if exists "checkins_select_private" on public.wellness_checkins;
create policy "checkins_select_private"
on public.wellness_checkins
for select
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "survey_read_own" on public.survey_responses;
drop policy if exists "survey_select_private" on public.survey_responses;
create policy "survey_select_private"
on public.survey_responses
for select
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin());

-- Prize history contains winner identities and is an admin function.
drop policy if exists "draw_results_read_all" on public.draw_results;
drop policy if exists "draw_results_select_admin" on public.draw_results;
create policy "draw_results_select_admin"
on public.draw_results
for select
to authenticated
using (public.current_user_is_admin());

-- Badge definitions are shared, but earned-badge rows are private until a
-- future privacy-safe public badge projection is added.
drop policy if exists "badges_read_all" on public.badges;
drop policy if exists "badges_select_authenticated" on public.badges;
create policy "badges_select_authenticated"
on public.badges
for select
to authenticated
using (true);

drop policy if exists "user_badges_read_all" on public.user_badges;
drop policy if exists "user_badges_select_private" on public.user_badges;
create policy "user_badges_select_private"
on public.user_badges
for select
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin());

-- Views can bypass underlying RLS when owned by a privileged role. Expose only
-- the two privacy-safe leaderboard projections to signed-in users.
revoke all on table public.leaderboard_totals from public, anon;
revoke all on table public.team_standings from public, anon;
grant select on table public.leaderboard_totals to authenticated;
grant select on table public.team_standings to authenticated;

revoke all on table public.draw_results_view from public, anon, authenticated;
revoke all on table public.profile_badges from public, anon, authenticated;

commit;
