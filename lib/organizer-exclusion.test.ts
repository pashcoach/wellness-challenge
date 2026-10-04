import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { excludeFromStandings } from "./organizer-exclusion";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migration-exclude-organizer-accounts.sql");
const schema = read("supabase/schema.sql");
const admin = read("app/admin/page.tsx");

test("organizer flags exist, default off, and are not participant-writable", () => {
  for (const sql of [migration, schema]) {
    assert.match(sql, /add column if not exists exclude_from_prizes boolean not null default false/i);
    assert.match(sql, /add column if not exists exclude_from_standings boolean not null default false/i);
  }
  assert.match(migration, /has_column_privilege\('authenticated', 'public\.profiles', 'exclude_from_prizes', 'UPDATE'\)/);
  assert.match(migration, /has_column_privilege\('authenticated', 'public\.profiles', 'exclude_from_standings', 'UPDATE'\)/);
});

test("the two organizer accounts are flagged exactly once each", () => {
  assert.match(migration, /full_name = 'P Ash' and p\.is_admin/);
  assert.match(migration, /full_name = 'Patrick Ash' and not p\.is_admin/);
  assert.match(migration, /exclude_from_prizes = true, exclude_from_standings = true/);
  assert.match(migration, /set exclude_from_prizes = true\s+where/);
  assert.match(migration, /if v_count <> 1 then/);
});

test("standings views skip accounts excluded from standings", () => {
  assert.match(migration, /create or replace view public\.leaderboard_totals/i);
  assert.match(migration, /where not p\.exclude_from_standings/);
  assert.match(migration, /create or replace view public\.team_standings/i);
  assert.match(migration, /left join public\.profiles p on p\.team_id = t\.id and not p\.exclude_from_standings/);
});

test("draw helper works under the draws' empty search_path", () => {
  const start = migration.indexOf("create or replace function public.user_week_points");
  assert.ok(start >= 0);
  const body = migration.slice(start, migration.indexOf("$$;", migration.indexOf("as $$", start)));
  assert.match(body, /set search_path = ''/);
  assert.match(body, /from public\.activity_entries/);
  assert.match(body, /from public\.wellness_checkins/);
});

test("every prize draw skips accounts excluded from prizes", () => {
  for (const fn of ["run_weekly_draw", "run_grand_prize_draw"]) {
    const start = migration.indexOf(`create or replace function public.${fn}`);
    assert.ok(start >= 0, fn);
    const body = migration.slice(start, migration.indexOf("$$;", start));
    assert.equal((body.match(/and not p\.exclude_from_prizes/g) ?? []).length, 2, fn);
  }
  const team = migration.slice(migration.indexOf("create or replace function public.run_random_team_draw"));
  assert.match(team, /and not p\.exclude_from_prizes/);
});

test("admin dashboard stats leave out accounts excluded from standings", () => {
  const rows = [
    { id: "a", exclude_from_standings: true },
    { id: "b", exclude_from_standings: false },
    { id: "c" },
  ];
  assert.deepEqual(excludeFromStandings(rows).map((r) => r.id), ["b", "c"]);
  assert.match(admin, /excludeFromStandings\(/);
  assert.match(admin, /Organizer accounts are excluded from all prize draws/);
});
