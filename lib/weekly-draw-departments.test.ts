import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = "supabase/migration-weekly-draw-different-departments.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const admin = readFileSync("app/admin/page.tsx", "utf8");
const weeklyFunction =
  migration.match(/create or replace function public\.run_weekly_draw\(p_week integer\)[\s\S]*?\n\$\$;/i)?.[0] ?? "";

test("weekly draw keeps the existing admin, eligibility, and one-run rules", () => {
  assert.match(weeklyFunction, /perform public\.require_current_user_admin\(\)/i);
  assert.match(weeklyFunction, /public\.user_week_points\(p\.id, p_week\) >= 140/i);
  assert.match(weeklyFunction, /public\.user_has_activity_in_week\(p\.id, p_week\)/i);
  assert.match(weeklyFunction, /not p\.exclude_from_prizes/i);
  assert.match(weeklyFunction, /not exists\s*\([\s\S]*?public\.draw_results[\s\S]*?d\.user_id = p\.id/i);
  assert.match(weeklyFunction, /insert into public\.draw_runs \(draw_key, run_by\)/i);
  assert.match(weeklyFunction, /has already been run/i);
});

test("weekly draw requires two departments before recording a run", () => {
  assert.match(migration, /create or replace function private\.normalize_department\(p_department text\)/i);
  assert.match(weeklyFunction, /count\(distinct private\.normalize_department\(p\.business_unit\)\)/i);
  assert.match(weeklyFunction, /v_departments < 2/i);
  const departmentCheck = weeklyFunction.search(/v_departments < 2/i);
  const runInsert = weeklyFunction.search(/insert into public\.draw_runs/i);
  assert.ok(departmentCheck > 0 && runInsert > departmentCheck, "department check must happen before the run is recorded");
});

test("weekly draw selects the second winner from a different department", () => {
  assert.match(weeklyFunction, /into v_first, v_first_department[\s\S]*?order by random\(\)\s+limit 1/i);
  assert.match(
    weeklyFunction,
    /private\.normalize_department\(p\.business_unit\) <> v_first_department[\s\S]*?order by random\(\)\s+limit 1/i
  );
  assert.match(weeklyFunction, /foreach v_user in array array\[v_first, v_second\]/i);
});

test("weekly draw stays callable only by signed-in administrators", () => {
  assert.match(migration, /revoke all on function public\.run_weekly_draw\(integer\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.run_weekly_draw\(integer\) to authenticated/i);
  assert.doesNotMatch(migration, /grant execute on function public\.run_weekly_draw\(integer\) to[^;]*anon/i);
});

test("admin page explains the different-department rule", () => {
  assert.match(admin, /weekly = 2 winners from different departments with 140\+ pts and 1\+ logged wellness activity that week/i);
  assert.match(admin, /2 winners from different departments, 140\+ pts and a logged wellness activity/i);
});
