// HISTORICAL SUPERSEDED top-three-rule regression tests, not current production policy.
// Current rule: week3-crc-two-units.test.mjs. No network or production connection.
// NODE_PATH=<scratch>/node_modules node --test supabase/tests/week3-crc-draw.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const { PGlite } = createRequire(import.meta.url)('@electric-sql/pglite');
const path = 'supabase/migration-week3-crc-guaranteed-winner.sql';
const baseline = readFileSync('supabase/migration-weekly-draw-different-departments.sql', 'utf8');
const migration = !process.env.CRC_DRAW_BASELINE && existsSync(path) ? readFileSync(path, 'utf8') : baseline;
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$select '${id(99)}'::uuid$$;
    create table public.profiles(id uuid primary key, full_name text, business_unit text,
      located_at_crc boolean not null default false, exclude_from_prizes boolean not null default false,
      exclude_from_standings boolean not null default false,
      points integer default 140, activity boolean default true);
    create table public.activity_entries(user_id uuid, week integer);
    create table public.wellness_checkins(user_id uuid, week integer);
    create table public.draw_runs(draw_key text primary key, run_by uuid);
    create table public.draw_results(draw_key text references public.draw_runs, user_id uuid unique references public.profiles);
    create function public.require_current_user_admin() returns void language plpgsql as $$begin end$$;
    create function public.user_week_points(uuid, integer) returns integer language sql as $$select points from public.profiles where id=$1$$;
    create function public.user_has_activity_in_week(uuid, integer) returns boolean language sql as $$select activity from public.profiles where id=$1$$;`);
  await db.exec(baseline);
  if (migration !== baseline) await db.exec(migration);
  return db;
}
async function person(db, n, dept, crc = false, points = 140, activity = true, excluded = false) {
  await db.query('insert into profiles(id,full_name,business_unit,located_at_crc,exclude_from_prizes,points,activity) values($1,$2,$3,$4,$5,$6,$7)', [id(n), `P${n}`, dept, crc, excluded, points, activity]);
  if (activity) await db.query('insert into activity_entries values ($1,3)', [id(n)]);
}
async function draw(db, week = 3) { return (await db.query('select * from public.run_weekly_draw($1)', [week])).rows; }

test('Readback SQL executes with installed-rule checks and no ledger changes', async () => {
  const db = await setup();
  try {
    const result = await db.exec(readFileSync('supabase/tests/week3-crc-guaranteed-winner-readback.sql', 'utf8'));
    const rule = result[0].rows[0];
    for (const [key, value] of Object.entries(rule)) if (key.startsWith('rule_')) assert.equal(value, true, key);
    assert.equal(rule.security_definer, true);
    assert.equal(rule.anon_can_execute, false);
    assert.equal(rule.authenticated_can_execute, true);
    await empty(db);
  } finally { await db.close(); }
});

test('Week 3 rejects same normalized department without consuming the run', async () => {
  const db = await setup();
  try {
    await person(db, 1, 'People & Culture', true);
    await person(db, 2, ' PEOPLE and Culture ');
    await assert.rejects(draw(db), /at least 2 departments/i);
    await empty(db);
    await person(db, 3, 'Operations');
    assert.equal((await draw(db)).length, 2);
  } finally { await db.close(); }
});

test('Week 3 is one-shot and does not modify earlier results', async () => {
  const db = await setup();
  try {
    for (let n = 1; n <= 6; n++) await person(db, n, `Dept${n}`, true);
    await db.exec(`insert into draw_runs values ('week2', '${id(99)}'); insert into draw_results values ('week2', '${id(6)}');`);
    await draw(db);
    const before = (await db.query('select * from draw_results order by draw_key, user_id')).rows;
    await assert.rejects(draw(db), /already been run/i);
    assert.deepEqual((await db.query('select * from draw_results order by draw_key, user_id')).rows, before);
  } finally { await db.close(); }
});

test('Week 4 retains normal different-department eligibility with no CRC participant', async () => {
  const db = await setup();
  try {
    await person(db, 1, 'Finance'); await person(db, 2, 'Operations');
    await person(db, 3, 'Other', true, 139);
    await person(db, 4, 'Other', true, 140, false);
    await person(db, 5, 'Other', true, 140, true, true);
    assert.deepEqual((await draw(db, 4)).map(x => x.winner_name).sort(), ['P1', 'P2']);
    await assert.rejects(draw(db, 4));
  } finally { await db.close(); }
});

test('Week 4 still fails closed for a single normalized department', async () => {
  const db = await setup();
  try {
    await person(db, 1, 'People & Culture'); await person(db, 2, 'People and Culture');
    await assert.rejects(draw(db, 4), /at least 2 departments/i);
    await empty(db, 4);
  } finally { await db.close(); }
});
test('Production rollback script passes against local PostgreSQL and persists nothing', async () => {
  const db = await setup();
  try {
    await db.exec('alter table profiles add column is_admin boolean default true');
    // person() specifies columns, so this local administrator column is safe.
    for (let n = 1; n <= 6; n++) await person(db, n, `Dept${n}`, n === 1);
    const before = (await db.query('select * from profiles order by id')).rows;
    const script = readFileSync('supabase/tests/week3-crc-guaranteed-winner-rollback-test.sql', 'utf8');
    await assert.rejects(db.exec(script), /TESTRESULT PASS:/);
    assert.deepEqual((await db.query('select * from profiles order by id')).rows, before);
    await empty(db);
    await draw(db);
    await assert.rejects(db.exec(script), /STOP: Week 3 already recorded/);
  } finally { await db.close(); }
});

test('Week 3 fails closed rather than falling back to an eligible rank-four CRC unit', async () => {
  const db = await setup();
  try {
    let n = 10;
    for (const [unit, count] of [['A', 4], ['B', 3], ['C', 2]]) {
      for (let j = 0; j < count; j++) await person(db, n++, unit, true, 139);
    }
    await person(db, 1, 'D', true);
    await person(db, 2, 'Outside');
    await assert.rejects(draw(db), /eligible CRC.*top three/i);
    await empty(db);
  } finally { await db.close(); }
});

for (const [counts, allowed] of [[[5, 3, 2, 2], true], [[5, 5, 2], true], [[5, 5, 5, 2], false]]) {
  test(`Week 3 competition ranks ${counts} include cutoff ties, not dense ranks`, async () => {
    const db = await setup();
    try {
      let n = 10;
      for (let u = 0; u < counts.length; u++) {
        for (let j = 0; j < counts[u]; j++) {
          await person(db, n++, `Unit${u}`, true, j === 0 && u === counts.length - 1 ? 140 : 139);
        }
      }
      await person(db, 1, 'Outside');
      if (allowed) assert.equal((await draw(db))[0].winner_business_unit, `Unit${counts.length - 1}`);
      else { await assert.rejects(draw(db), /eligible CRC.*top three/i); await empty(db); }
    } finally { await db.close(); }
  });
}

test('Week 3 ranking counts distinct activity OR checkin people, normalizes units and excludes organizers/non-CRC/other weeks', async () => {
  const db = await setup();
  try {
    let n = 10;
    for (const [unit, count] of [['A', 5], ['B', 4], ['People & Culture', 2], ['D', 2]]) {
      for (let j = 0; j < count; j++) await person(db, n++, unit, true, 139);
    }
    // A checkin-only low-points participant lifts normalized People & Culture to rank 3.
    await person(db, 1, ' PEOPLE and   Culture ', true, 139, false);
    await db.query('insert into wellness_checkins values ($1,3)', [id(1)]);
    // Prior winners still count for participation ranking, but cannot win again.
    await db.exec(`insert into draw_runs values ('week1', '${id(99)}'); insert into draw_results values ('week1', '${id(1)}');`);
    await person(db, 2, 'People and Culture', true);
    await person(db, 3, 'D', true); // D stays rank 4 despite many events and excluded people.
    for (let j = 0; j < 10; j++) {
      await db.query('insert into activity_entries values ($1,3)', [id(3)]);
      await db.query('insert into wellness_checkins values ($1,3)', [id(3)]);
      await person(db, 100+j, 'D', true, 139, true, true);
      await person(db, 200+j, 'D', true, 139);
      await db.query('update profiles set exclude_from_standings=true where id=$1', [id(200+j)]);
      await person(db, 300+j, 'D', false, 139);
      await person(db, 400+j, 'D', true, 139, false);
      await db.query('insert into activity_entries values ($1,2)', [id(400+j)]);
    }
    for (let round = 0; round < 10; round++) {
      assert.deepEqual((await draw(db)).map(x => x.winner_name), ['P2', 'P3']);
      await db.exec("delete from draw_results where draw_key='week3'; delete from draw_runs where draw_key='week3';");
    }
  } finally { await db.close(); }
});

async function empty(db, week = 3) {
  assert.equal((await db.query('select * from draw_runs where draw_key=$1', [`week${week}`])).rows.length, 0);
  assert.equal((await db.query('select * from draw_results where draw_key=$1', [`week${week}`])).rows.length, 0);
}
test('Week 3 first winner is eligible CRC; second uses the full pool and a different normalized department', async () => {
  const db = await setup();
  try {
    await person(db, 1, 'People & Culture', true);
    await person(db, 2, '  PEOPLE and   Culture ');
    await person(db, 3, 'Operations');
    await person(db, 4, 'Finance', true, 139);
    await person(db, 5, 'Finance', true, 140, false);
    await person(db, 6, 'Finance', true, 140, true, true);
    await person(db, 7, 'Finance', true);
    await person(db, 8, '  ', true);
    await db.exec(`insert into draw_runs values ('week1', '${id(99)}'); insert into draw_results values ('week1', '${id(7)}');`);
    for (let round = 0; round < 25; round++) {
      assert.deepEqual((await draw(db)).map(x => x.winner_name), ['P1', 'P3']);
      assert.equal((await db.query("select * from draw_runs where draw_key='week3'")).rows.length, 1);
      // Roll back each simulated local draw, never production.
      await db.exec("delete from draw_results where draw_key='week3'; delete from draw_runs where draw_key='week3';");
    }
    assert.equal((await db.query("select * from draw_results where draw_key='week1'")).rows.length, 1);
  } finally { await db.close(); }
});

test('Week 3 fails closed with no eligible CRC, even with two eligible departments', async () => {
  const db = await setup();
  try {
    await person(db, 1, 'Finance'); await person(db, 2, 'Operations');
    await assert.rejects(draw(db), /eligible CRC/i);
    await empty(db);
  } finally { await db.close(); }
});
