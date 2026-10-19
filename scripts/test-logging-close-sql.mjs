// Isolated embedded PostgreSQL test. Never connects to Supabase or reads .env.
// See docs/operations/2026-logging-close.md for the scratch-only dependency setup.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const require = createRequire(resolve(process.env.PGLITE_TEST_ROOT ?? process.cwd(), "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated;
    create table public.activity_entries (id integer);
    create table public.wellness_checkins (id integer);`);
  const migration = readFileSync(new URL("../supabase/migration-challenge-logging-close.sql", import.meta.url), "utf8");
  // Re-running the additive migration must be safe.
  await db.exec(migration);
  await db.exec(migration);
  const result = await db.exec(readFileSync(new URL("../supabase/tests/logging-close-rollback-test.sql", import.meta.url), "utf8"));
  assert.equal(result.at(-1).rows[0].restored_cutoff_pass, true);
  const { rows } = await db.query(`select
    public.challenge_logging_is_closed('2026-10-31T05:59:59.999999Z') as before_cutoff,
    public.challenge_logging_is_closed('2026-10-31T06:00:00Z') as at_cutoff,
    (select count(*)::integer from pg_trigger where tgname like 'enforce_challenge_logging_close%' and tgenabled = 'O') as enabled_triggers,
    (select count(*)::integer from public.activity_entries) as activity_rows,
    (select count(*)::integer from public.wellness_checkins) as checkin_rows`);
  assert.deepEqual(rows[0], { before_cutoff: false, at_cutoff: true, enabled_triggers: 2, activity_rows: 0, checkin_rows: 0 });
  console.log("PASS: idempotent migration, microsecond boundaries, both table guards, authenticated INSERT/UPDATE/DELETE and zero-row denials, reads preserved, rollback restored helpers; no participant records used.");
} catch (error) {
  console.error("SQL close test failed:", error.code ?? "", error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
