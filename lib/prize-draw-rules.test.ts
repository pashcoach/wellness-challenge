import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migration-exclude-top-team-random-draw.sql"),
  "utf8"
);
const activityEligibilityMigration = readFileSync(
  resolve(process.cwd(), "supabase/migration-require-activity-for-prize-draws.sql"),
  "utf8"
);
const admin = readFileSync(resolve(process.cwd(), "app/admin/page.tsx"), "utf8");

test("random team lunch excludes the highest-average team", () => {
  assert.match(migration, /create or replace function public\.run_random_team_draw\(\)/i);
  assert.match(migration, /from public\.team_standings/i);
  assert.match(migration, /t\.id\s*<>\s*v_top_team/i);
  assert.match(migration, /order by ts\.avg desc, ts\.name asc, ts\.id asc/i);
  assert.match(admin, /excluding the top team/i);
});

test("grand prize continues to exclude prior weekly winners", () => {
  const grandPrizeFunction = migration.match(
    /create or replace function public\.run_grand_prize_draw\(\)[\s\S]*?\n\$\$;/i
  )?.[0] ?? "";

  assert.match(grandPrizeFunction, /not exists\s*\([\s\S]*?public\.draw_results[\s\S]*?d\.user_id = p\.id/i);
});

test("weekly draws require 140 points and at least one activity in that week", () => {
  const weeklyFunction = activityEligibilityMigration.match(
    /create or replace function public\.run_weekly_draw\(p_week integer\)[\s\S]*?\n\$\$;/i
  )?.[0] ?? "";

  assert.match(weeklyFunction, /public\.user_week_points\(p\.id, p_week\) >= 140/i);
  assert.match(weeklyFunction, /public\.user_has_activity_in_week\(p\.id, p_week\)/i);
  assert.match(admin, /140\+ pts and 1\+ logged wellness activity that week/i);
});

test("grand prize requires at least one activity in each of the four weeks", () => {
  const grandFunction = activityEligibilityMigration.match(
    /create or replace function public\.run_grand_prize_draw\(\)[\s\S]*?\n\$\$;/i
  )?.[0] ?? "";

  for (const week of [1, 2, 3, 4]) {
    assert.match(grandFunction, new RegExp(`public\\.user_has_activity_in_week\\(p\\.id, ${week}\\)`));
  }
  assert.match(admin, /1\+ logged wellness activity in each week/i);
});
