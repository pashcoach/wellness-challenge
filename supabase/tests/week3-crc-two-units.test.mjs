// Local PostgreSQL/WASM only. No network or production credentials.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const { PGlite } = createRequire(import.meta.url)('@electric-sql/pglite');
const path = 'supabase/migration-week3-crc-two-units.sql';
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table profiles(id uuid primary key, full_name text, business_unit text,
      located_at_crc boolean default false, exclude_from_prizes boolean default false,
      exclude_from_standings boolean default false, is_admin boolean default false,
      points integer default 140, activity boolean default true);
    create table activity_entries(user_id uuid, week integer);
    create table wellness_checkins(user_id uuid, week integer);
    create table draw_runs(draw_key text primary key, run_by uuid);
    create table draw_results(draw_key text references draw_runs, user_id uuid unique references profiles);
    create function public.require_current_user_admin() returns void language plpgsql as $$begin
      if not exists(select 1 from public.profiles where id=auth.uid() and is_admin) then raise exception 'Admin required'; end if; end$$;
    create function public.user_week_points(uuid,integer) returns integer language sql as $$select points from public.profiles where id=$1$$;
    create function public.user_has_activity_in_week(uuid,integer) returns boolean language sql as $$select activity from public.profiles where id=$1$$;
    insert into profiles(id,full_name,business_unit,is_admin,exclude_from_prizes) values('${id(99)}','Admin','Admin',true,true);
    select set_config('request.jwt.claim.sub','${id(99)}',false);`);
  await db.exec(readFileSync('supabase/migration-weekly-draw-different-departments.sql','utf8'));
  await db.exec(readFileSync('supabase/migration-week3-crc-guaranteed-winner.sql','utf8'));
  if (existsSync(path) && !process.env.CRC_DRAW_BASELINE) await db.exec(readFileSync(path,'utf8'));
  return db;
}
async function person(db,n,unit,crc=true,points=140,activity=true,prizes=false,hidden=false) {
  await db.query('insert into profiles(id,full_name,business_unit,located_at_crc,points,activity,exclude_from_prizes,exclude_from_standings) values($1,$2,$3,$4,$5,$6,$7,$8)',[id(n),`P${n}`,unit,crc,points,activity,prizes,hidden]);
}
async function draw(db,week=3) { return (await db.query('select * from public.run_weekly_draw($1)',[week])).rows; }
async function empty(db) { assert.equal((await db.query("select count(*)::int n from draw_runs where draw_key='week3'")).rows[0].n,0); assert.equal((await db.query("select count(*)::int n from draw_results where draw_key='week3'")).rows[0].n,0); }

test('Week3 BOTH winners CRC in named units, never FCL or nonCRC fallback', async () => {
  const db=await setup();
  try {
    await person(db,1,' ENERGY &   AG '); await person(db,2,'Consumer Products');
    await person(db,3,'FCL'); await person(db,4,'Energy and Ag',false); await person(db,5,'Consumer Products',false);
    for(let n=0;n<20;n++) {
      assert.deepEqual((await draw(db)).map(x=>x.winner_name).sort(),['P1','P2']);
      await db.exec("delete from draw_results where draw_key='week3'; delete from draw_runs where draw_key='week3'");
    }
  } finally { await db.close(); }
});

for (const missing of ['Energy & Ag','Consumer Products']) {
  test(`Week3 fails closed when ${missing} pool missing; no fallback or consumed run`, async()=>{
    const db=await setup(); try {
      await person(db,1,missing==='Energy & Ag'?'Consumer Products':'Energy & Ag');
      await person(db,2,missing,false); await person(db,3,'FCL');
      await assert.rejects(draw(db),/BOTH Energy & Ag and Consumer Products/); await empty(db);
    } finally {await db.close();}
  });
}
test('Week3 rejects low points, no activity, either exclusion flag and prior winners in BOTH pools',async()=>{
  const db=await setup(); try {
    let n=1;
    for(const unit of ['Energy & Ag','Consumer Products']) {
      await person(db,n++,unit,true,139); await person(db,n++,unit,true,140,false);
      await person(db,n++,unit,true,140,true,true); await person(db,n++,unit,true,140,true,false,true);
      await person(db,n,unit);
      await db.exec(`insert into draw_runs values('prior${n}','${id(99)}'); insert into draw_results values('prior${n}','${id(n)}');`); n++;
    }
    await assert.rejects(draw(db),/BOTH/); await empty(db);
    await person(db,50,'Energy & Ag'); await person(db,51,'Consumer Products');
    assert.deepEqual((await draw(db)).map(x=>x.winner_name).sort(),['P50','P51']);
    const before=(await db.query('select * from draw_results order by draw_key,user_id')).rows;
    await assert.rejects(draw(db));
    assert.deepEqual((await db.query('select * from draw_results order by draw_key,user_id')).rows,before);
  }finally{await db.close();}
});
test('Week3 random selection can reach every eligible candidate in each pool',async()=>{
  const db=await setup();try{
    for(let n=1;n<=4;n++)await person(db,n,n<=2?'Energy & Ag':'Consumer Products');
    const seen=new Set();
    for(let n=0;n<80;n++){
      (await draw(db)).forEach(x=>seen.add(x.winner_name));
      await db.exec("delete from draw_results; delete from draw_runs;");
    }
    assert.deepEqual([...seen].sort(),['P1','P2','P3','P4']);
  }finally{await db.close();}
});
test('Week4 preserves nonCRC and standings-hidden baseline eligibility; admin guard and grants preserved',async()=>{
  const db=await setup();try{
    await person(db,1,'Finance',false,140,true,false,true);await person(db,2,'Operations',false);
    await db.exec("select set_config('request.jwt.claim.sub','',false)");
    await assert.rejects(draw(db,4),/Admin required/);
    await db.exec(`select set_config('request.jwt.claim.sub','${id(99)}',false)`);
    assert.deepEqual((await draw(db,4)).map(x=>x.winner_name).sort(),['P1','P2']);
    const perms=(await db.query("select has_function_privilege('anon','public.run_weekly_draw(integer)','execute') anon, has_function_privilege('authenticated','public.run_weekly_draw(integer)','execute') authenticated")).rows[0];
    assert.deepEqual(perms,{anon:false,authenticated:true});
  }finally{await db.close();}
});
test('Migration refuses existing Week3 ledger and preserves installed definition',async()=>{
 const db=await setup();try{
   await db.exec(`insert into draw_runs values('week3','${id(99)}')`);
   await assert.rejects(db.exec(readFileSync(path,'utf8')),/STOP: Week 3 already recorded/);
   await db.exec('rollback');
 }finally{await db.close();}
});
test('New readback and rollback-only scripts execute locally without persisted writes',async()=>{
 const db=await setup();try{
   await person(db,1,'Energy & Ag');await person(db,2,'Consumer Products');
   const before=(await db.query('select * from profiles order by id')).rows;
   const result=await db.exec(readFileSync('supabase/tests/week3-crc-two-units-readback.sql','utf8'));
   for(const [k,v] of Object.entries(result[0].rows[0]))if(k.startsWith('rule_'))assert.equal(v,true,k);
   await assert.rejects(db.exec(readFileSync('supabase/tests/week3-crc-two-units-rollback-test.sql','utf8')),/TESTRESULT PASS:/);
   await empty(db);assert.deepEqual((await db.query('select * from profiles order by id')).rows,before);
 }finally{await db.close();}
});
