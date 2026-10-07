import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = "supabase/migration-team-minimum.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const schema = readFileSync("supabase/schema.sql", "utf8");
const soloCard = readFileSync("components/SoloTeamCard.tsx", "utf8");
const teamManagement = readFileSync("components/TeamManagement.tsx", "utf8");
const help = readFileSync("components/FeedbackButton.tsx", "utf8");

for (const [label, sql] of [["migration", migration], ["schema", schema]] as const) {
  test(`${label} closes all team creation and joining after October 11`, () => {
    assert.match(sql, /create or replace function public\.can_current_user_create_team\(\)[\s\S]*and public\.solo_week_one_join_open\(\)/i);
    assert.match(sql, /create or replace function public\.can_current_user_join_team\(\)[\s\S]*and public\.solo_week_one_join_open\(\)/i);
    assert.match(sql, /require_team_create_allowed[\s\S]*if not public\.solo_week_one_join_open\(\)/i);
    assert.match(sql, /require_team_join_allowed[\s\S]*if not public\.solo_week_one_join_open\(\)/i);
  });
}

test("the cleanup is one-shot, date-gated, private, and deletes teams below two members", () => {
  assert.match(migration, /create table if not exists public\.team_minimum_cleanup_runs/i);
  assert.match(migration, /run_key text primary key/i);
  assert.match(migration, /create or replace function public\.admin_enforce_team_minimum\(p_at timestamptz default now\(\)\)/i);
  assert.match(migration, /timezone\('America\/Regina', p_at\)::date < date '2026-10-12'/i);
  assert.match(migration, /having count\(p\.id\) < 2/i);
  assert.match(migration, /delete from public\.teams/i);
  assert.match(migration, /insert into public\.team_minimum_cleanup_runs/i);
  assert.match(migration, /revoke all on function public\.admin_enforce_team_minimum\(timestamptz\) from public, anon, authenticated, service_role/i);
  assert.doesNotMatch(migration, /grant execute on function public\.admin_enforce_team_minimum/i);
});

test("participants see the deadline and two-member requirement before and after creating", () => {
  assert.match(soloCard, /Team setup closes October 11/i);
  assert.match(soloCard, /at least two members by the deadline/i);
  assert.match(teamManagement, /memberCount === 1/);
  assert.match(teamManagement, /Invite at least one teammate by October 11/i);
  assert.match(teamManagement, /removed and you will continue as a solo participant/i);
  assert.match(help, /Teams must have at least two members by the end of October 11/i);
  assert.match(help, /one-person teams will be removed/i);
});
