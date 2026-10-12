import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = "supabase/migration-week1-department-correction.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const correctionFunction =
  migration.match(
    /create or replace function public\.admin_correct_weekly_draw_department_conflict\(p_week integer\)[\s\S]*?\n\$\$;/i
  )?.[0] ?? "";

test("department correction keeps an audit record and runs once per draw", () => {
  assert.match(migration, /create table if not exists private\.prize_draw_department_corrections/i);
  assert.match(migration, /draw_key text primary key/i);
  assert.match(migration, /removed_user_id uuid not null/i);
  assert.match(migration, /replacement_user_id uuid not null/i);
  assert.match(correctionFunction, /from private\.prize_draw_department_corrections/i);
  assert.match(correctionFunction, /already been corrected/i);
  assert.match(correctionFunction, /for update/i);
});

test("department correction keeps one current winner at random and replaces only the other", () => {
  assert.match(correctionFunction, /v_result_count <> 2/i);
  assert.match(correctionFunction, /v_department_count <> 1/i);
  assert.match(correctionFunction, /order by random\(\)\s+limit 1/i);
  assert.match(correctionFunction, /delete from public\.draw_results[\s\S]*?id = v_removed\.id/i);
  assert.match(correctionFunction, /insert into public\.draw_results \(draw_key, user_id\)/i);
});

test("replacement follows weekly eligibility and must be from another department", () => {
  assert.match(migration, /create or replace function private\.normalize_department\(p_department text\)/i);
  assert.match(migration, /replace\(coalesce\(p_department, ''\), '&', ' and '\)/i);
  assert.match(correctionFunction, /public\.user_week_points\(p\.id, p_week\) >= 140/i);
  assert.match(correctionFunction, /public\.user_has_activity_in_week\(p\.id, p_week\)/i);
  assert.match(correctionFunction, /not p\.exclude_from_prizes/i);
  assert.match(correctionFunction, /not exists\s*\([\s\S]*?public\.draw_results[\s\S]*?d\.user_id = p\.id/i);
  assert.match(correctionFunction, /private\.normalize_department\(p\.business_unit\) <> v_kept_department/i);
  assert.match(correctionFunction, /v_final_departments <> 2/i);
});

test("department correction is limited to the SQL editor operator", () => {
  assert.match(
    migration,
    /revoke all on function public\.admin_correct_weekly_draw_department_conflict\(integer\) from public, anon, authenticated, service_role/i
  );
  assert.doesNotMatch(migration, /grant execute on function public\.admin_correct_weekly_draw_department_conflict/i);
  assert.match(migration, /revoke all on table private\.prize_draw_department_corrections from public, anon, authenticated, service_role/i);
});
