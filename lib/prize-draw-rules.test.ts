import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migration-exclude-top-team-random-draw.sql"),
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
