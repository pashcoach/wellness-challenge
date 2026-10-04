import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasConfirmedTeamMembership } from "./team-management";


const migration = readFileSync(
  resolve(process.cwd(), "supabase/migration-team-management.sql"),
  "utf8"
);
const schema = readFileSync(resolve(process.cwd(), "supabase/schema.sql"), "utf8");
const component = readFileSync(
  resolve(process.cwd(), "components/TeamManagement.tsx"),
  "utf8"
);
const dashboard = readFileSync(resolve(process.cwd(), "components/Dashboard.tsx"), "utf8");
const soloCard = readFileSync(resolve(process.cwd(), "components/SoloTeamCard.tsx"), "utf8");
const setup = readFileSync(resolve(process.cwd(), "components/TeamSetup.tsx"), "utf8");
const data = readFileSync(resolve(process.cwd(), "lib/data.ts"), "utf8");
const roster = readFileSync(resolve(process.cwd(), "components/TeamRoster.tsx"), "utf8");
const feed = readFileSync(resolve(process.cwd(), "components/TeamFeed.tsx"), "utf8");
const home = readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf8");

test("the first activity or check-in creates an irreversible team-change lock", () => {
  assert.match(migration, /create table[^;]*participant_team_locks/is);
  assert.match(migration, /insert into public\.participant_team_locks/i);
  assert.match(migration, /before insert on public\.activity_entries/i);
  assert.match(migration, /before insert on public\.wellness_checkins/i);
  assert.match(migration, /on conflict \(user_id\) do nothing/i);
  assert.match(migration, /lock table[\s\S]*public\.activity_entries, public\.wellness_checkins[\s\S]*share row exclusive mode/i);
});

test("the fresh schema defines the team-code helper before teams use it", () => {
  assert.ok(schema.indexOf("function gen_join_code") < schema.indexOf("create table if not exists teams"));
});

test("team setup advances only after an error-free profile refresh confirms membership", () => {
  assert.equal(hasConfirmedTeamMembership({ data: { team_id: "team-1" }, error: null }), true);
  assert.equal(hasConfirmedTeamMembership({ data: { team_id: null }, error: null }), false);
  assert.equal(hasConfirmedTeamMembership({ data: { team_id: "team-1" }, error: new Error("offline") }), false);
  assert.equal(hasConfirmedTeamMembership({ data: null, error: null }), false);
});

test("the database blocks direct team changes after challenge participation starts", () => {
  assert.match(migration, /revoke update on table public\.profiles from authenticated/i);
  assert.match(migration, /grant update \(full_name, username, business_unit, located_at_crc, age_range\)/i);
  assert.match(migration, /revoke insert on table public\.teams from authenticated/i);
  assert.match(migration, /grant insert \(id, full_name, username, business_unit, located_at_crc, age_range\)/i);
  assert.match(migration, /team_id is null[\s\S]*is_admin = false/i);
  assert.match(migration, /create or replace function public\.can_current_user_change_teams/i);
  assert.match(migration, /select 1 from public\.profiles[\s\S]*for update/i);
});

test("leaving transfers ownership when members remain and removes an empty team", () => {
  const leaveFunction = migration.match(
    /create or replace function public\.leave_current_team\(\)[\s\S]*?\n\$\$;/i
  )?.[0] ?? "";
  assert.match(leaveFunction, /update public\.teams[\s\S]*created_by = v_next_creator/i);
  assert.match(leaveFunction, /delete from public\.teams/i);
  assert.match(leaveFunction, /update public\.profiles[\s\S]*team_id = null/i);
  const memberLock = leaveFunction.indexOf("from public.profiles member");
  const teamLock = leaveFunction.indexOf("from public.teams t");
  assert.ok(memberLock > 0 && memberLock < teamLock);
  assert.match(leaveFunction, /v_was_creator[\s\S]*errcode = '40001'/i);
  assert.match(leaveFunction, /v_prelocked_members uuid\[\]/i);
  assert.match(leaveFunction, /not \(member\.id = any\(v_prelocked_members\)\)[\s\S]*errcode = '40001'/i);
});

test("a failed profile read cannot route a participant into onboarding", () => {
  assert.match(data, /profileError/);
  assert.match(data, /profileState/);
  assert.match(data, /requestIdRef/);
  assert.match(data, /profileState\?\.userId === sessionUserId/);
  assert.match(home, /profileError[\s\S]*couldn&apos;t load your participant profile/i);
  assert.ok(home.indexOf("if (profileError)") < home.indexOf("if (!profile)"));
});

test("only a sole team creator can delete a team", () => {
  const deleteFunction = migration.match(
    /create or replace function public\.delete_my_team\(\)[\s\S]*?\n\$\$;/i
  )?.[0] ?? "";
  assert.match(deleteFunction, /v_creator is distinct from auth\.uid\(\)/i);
  assert.match(deleteFunction, /v_member_count > 1/i);
  assert.match(deleteFunction, /delete from public\.teams/i);
  assert.match(migration, /create or replace function public\.preserve_team_ownership_on_profile_delete/i);
  assert.match(migration, /before delete on public\.profiles/i);
  assert.match(migration, /alter column created_by set not null/i);
  assert.match(migration, /foreign key \(created_by\)[\s\S]*on delete restrict/i);
  assert.match(migration, /Leave or delete your team before deleting your participant profile/i);
  const profileDeleteFunction = migration.match(
    /create or replace function public\.preserve_team_ownership_on_profile_delete\(\)[\s\S]*?\n\$\$;/i
  )?.[0] ?? "";
  assert.ok(profileDeleteFunction.indexOf("from public.profiles member") < profileDeleteFunction.indexOf("from public.teams t"));
  assert.match(profileDeleteFunction, /v_prelocked_members uuid\[\]/i);
  assert.match(profileDeleteFunction, /not \(member\.id = any\(v_prelocked_members\)\)[\s\S]*errcode = '40001'/i);
});

test("the team card exposes confirmed leave and creator-only delete controls", () => {
  assert.match(component, /Leave team/);
  assert.match(component, /Delete team/);
  assert.match(component, /team\.created_by === profile\.id/);
  assert.match(component, /You can change teams only before your first entry in the app/);
  assert.match(component, /checking “I supported my .* this week” and selecting “Confirm check-in/);
  assert.match(component, /After either action, leaving, switching, and deleting a team are locked/);
  assert.match(component, /Use Need help to leave a message for the app team to assist with this correction/);
  assert.doesNotMatch(component, /Contact Patrick/);
  assert.match(component, /Before that cutoff, you can delete this team only after all other members have left/);
  assert.match(data, /get_my_team_member_count/);
  assert.match(data, /teamLoadError/);
  assert.match(dashboard, /<TeamManagement/);
  assert.match(dashboard, /couldn&apos;t load your team/);
  assert.match(soloCard, /Team changes are locked after your first entry in the app/);
  assert.match(soloCard, /completing the Weekly Wellness section/);
  assert.match(soloCard, /Use Need help to leave a message for the app team to assist with this correction/);
  assert.doesNotMatch(soloCard, /Contact Patrick/);
  assert.match(data, /created_by: string \| null/);
  assert.match(data, /can_current_user_change_teams/);
  assert.match(component, /memberCountError/);
  assert.match(soloCard, /teamLoadError/);
  assert.match(setup, /teamLoadError/);
});

test("team creation and joining use transactional server functions", () => {
  assert.match(migration, /create or replace function public\.create_team_and_join/i);
  assert.match(migration, /create or replace function public\.join_team/i);
  assert.match(setup, /\.rpc\("create_team_and_join"/);
  assert.match(setup, /\.rpc\("join_team"/);
  assert.match(soloCard, /\.rpc\("create_team_and_join"/);
  assert.match(soloCard, /\.rpc\("join_team"/);
  assert.doesNotMatch(setup, /\.from\("teams"\)\.insert/);
  assert.doesNotMatch(soloCard, /\.from\("teams"\)\.insert/);
  assert.match(setup, /hasConfirmedTeamMembership\(refreshed\)/);
  assert.ok((setup.match(/await onRefresh\(\)/g) ?? []).length >= 4);
});

test("profile and roster reads expose only authorized participant data", () => {
  assert.match(migration, /drop policy if exists "profiles_read_all"/i);
  assert.match(migration, /create policy "profiles_read_own_or_admin"/i);
  assert.match(migration, /create or replace function public\.get_my_team_roster/i);
  assert.match(migration, /create or replace function public\.get_my_team_activity/i);
  assert.match(roster, /\.rpc\("get_my_team_roster"/);
  assert.match(feed, /\.rpc\("get_my_team_activity"/);
  assert.doesNotMatch(roster, /\.from\("profiles"\)/);
  assert.doesNotMatch(feed, /\.from\("profiles"\)/);
  assert.match(migration, /drop policy if exists "activity_read_all"/i);
  assert.match(migration, /create policy "activity_read_own_or_admin"/i);
  assert.match(migration, /drop policy if exists "checkins_read_all"/i);
  assert.match(migration, /create policy "checkins_read_own_or_admin"/i);
  assert.match(migration, /create policy "teams_read_authenticated"[\s\S]*to authenticated/i);
  assert.match(migration, /revoke select on table public\.teams from anon/i);
  assert.doesNotMatch(migration, /create policy "teams_read_all"/i);
  const adminFunction = migration.match(
    /create or replace function public\.is_current_user_admin\(\)[\s\S]*?\n\$\$;/i
  )?.[0] ?? "";
  assert.match(adminFunction, /auth\.users[\s\S]*raw_app_meta_data/i);
  assert.doesNotMatch(adminFunction, /public\.profiles/i);
  assert.match(migration, /update public\.profiles p[\s\S]*raw_app_meta_data[\s\S]*'is_admin'/i);
});
