import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migration-week3-crc-guaranteed-winner.sql", "utf8");
const baseline = readFileSync("supabase/migration-weekly-draw-different-departments.sql", "utf8");
const extract = (text: string) => text.match(/create or replace function public\.run_weekly_draw\(p_week integer\)[\s\S]*?\n\$\$;/i)?.[0];

test("CRC migration changes only Week 3 first-selection behavior, leaving all other draw rules intact", () => {
  const actual = extract(sql);
  assert.ok(actual);
  assert.equal(actual
    .replace("  v_top_crc_units text[];\n", "")
    .replace(/  -- BEGIN WEEK3 CRC RANKING[\s\S]*?  -- END WEEK3 CRC RANKING\n\n/, "")
    .replace(/    and \(p_week <> 3 or \(p\.located_at_crc is true[\s\S]*?any\(v_top_crc_units\)\)\)\n/, "")
    .replace(/  if p_week = 3 and v_first is null then[\s\S]*?  end if;\n\n/, ""), extract(baseline));
  assert.match(actual, /rank\(\) over \(order by active_participants desc\)/);
  assert.match(actual, /participant_rank <= 3/);
  assert.match(actual, /count\(distinct p\.id\)/);
  assert.match(actual, /public\.activity_entries[\s\S]*?or exists[\s\S]*?public\.wellness_checkins/);
  const second = actual.slice(actual.indexOf("  select p.id\n  into v_second"));
  assert.doesNotMatch(second, /located_at_crc|v_top_crc_units|exclude_from_standings/);
  assert.match(second, /private\.normalize_department\(p\.business_unit\) <> v_first_department/);
  assert.match(sql, /revoke all on function public\.run_weekly_draw\(integer\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.run_weekly_draw\(integer\) to authenticated/);
  assert.doesNotMatch(sql, /create or replace function (?!public\.run_weekly_draw)/i);
});

test("production verification never deletes draw history, refuses an existing Week 3, and ends by rolling back", () => {
  const verification = readFileSync("supabase/tests/week3-crc-guaranteed-winner-rollback-test.sql", "utf8");
  assert.doesNotMatch(verification, /\bdelete\s+from\b|\btruncate\b/i);
  assert.match(verification, /STOP: Week 3 already recorded/);
  assert.match(verification, /RAISE EXCEPTION 'TESTRESULT PASS:[^']+';\s*END \$test\$;\s*$/);
});
