import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const migrationPath = "supabase/migration-solo-week-one-team-join.sql";
const migration = (() => {
  try { return source(migrationPath); } catch { return ""; }
})();
const creationMigrationPath = "supabase/migration-solo-week-one-team-create.sql";
const creationMigration = (() => {
  try { return source(creationMigrationPath); } catch { return ""; }
})();

test("locked solo participants may join an existing team during Week 1", () => {
  assert.match(migration, /create or replace function public\.can_current_user_join_team\(\)/i);
  assert.match(migration, /team_id is null/i);
  assert.match(migration, /timezone\('America\/Regina', p_at\)::date between date '2026-10-05' and date '2026-10-11'/i);
  assert.match(migration, /public\.solo_week_one_join_open\(\)/i);
  assert.match(migration, /create or replace function public\.join_team\(p_team uuid\)/i);
  assert.match(migration, /perform public\.require_team_join_allowed\(\)/i);
});

test("locked solo participants may create a team during Week 1", () => {
  assert.match(creationMigration, /create or replace function public\.can_current_user_create_team\(\)/i);
  assert.match(creationMigration, /team_id is null/i);
  assert.match(creationMigration, /public\.solo_week_one_join_open\(\)/i);
  assert.match(creationMigration, /create or replace function public\.create_team_and_join\(p_name text\)/i);
  assert.match(creationMigration, /perform public\.require_team_create_allowed\(\)/i);
});

test("the Week 1 exception still cannot leave or switch teams", () => {
  assert.doesNotMatch(creationMigration, /create or replace function public\.leave_current_team/i);
  assert.match(migration, /if v_current_team is not null[\s\S]*Leave your current team before joining another team/i);
  assert.match(migration, /participant_team_locks[\s\S]*Joining a team after your first entry is only available to solo participants during Week 1/i);
});

test("the solo card exposes creating and joining under the Week 1 exception", () => {
  const card = source("components/SoloTeamCard.tsx");
  const dashboard = source("components/Dashboard.tsx");
  const data = source("lib/data.ts");
  assert.match(data, /canJoinTeam/);
  assert.match(data, /canCreateTeam/);
  assert.match(data, /can_current_user_join_team/);
  assert.match(data, /can_current_user_create_team/);
  assert.match(dashboard, /canJoin=\{canJoinTeam\}/);
  assert.match(dashboard, /canCreate=\{canCreateTeam\}/);
  assert.match(card, /canJoin: boolean/);
  assert.match(card, /canCreate: boolean/);
  assert.match(card, /canCreate &&[\s\S]*Create a team/);
  assert.match(card, /canJoin &&[\s\S]*Join a team/);
  assert.match(card, /Solo participants can create or join a team through October 11/);
});

test("Need help explains the Week 1 solo team setup exception", () => {
  const help = source("components/FeedbackButton.tsx");
  assert.match(help, /Solo participants may create or join a team anytime during Week 1, through October 11/i);
  assert.match(help, /cannot leave or switch teams after your first entry/i);
});
