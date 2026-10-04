import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeTeamCode } from "./team-management";
import { friendlyError } from "./errors";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migration-join-team-by-code.sql");
const schema = read("supabase/schema.sql");
const codeJoin = read("components/TeamCodeJoin.tsx");
const setup = read("components/TeamSetup.tsx");
const soloCard = read("components/SoloTeamCard.tsx");
const dashboard = read("components/Dashboard.tsx");
const help = read("components/FeedbackButton.tsx");

test("team codes are normalized from pasted invite text", () => {
  assert.equal(normalizeTeamCode("  ab12cd "), "AB12CD");
  assert.equal(normalizeTeamCode("ab 12-cd"), "AB12CD");
  assert.equal(normalizeTeamCode(""), "");
});

test("joining by code uses a locked-down server function that reuses join rules", () => {
  for (const sql of [migration, schema]) {
    assert.match(sql, /create or replace function public\.join_team_by_code\(p_code text\)/i);
    assert.match(sql, /security definer/i);
    assert.match(sql, /perform public\.join_team\(v_team\)/i);
    assert.match(sql, /No team matches that code/);
    assert.match(sql, /revoke all on function public\.join_team_by_code\(text\) from public, anon, authenticated/i);
    assert.match(sql, /grant execute on function public\.join_team_by_code\(text\) to authenticated/i);
  }
});

test("Enter team code form is accessible and appears beside both team lists", () => {
  assert.match(codeJoin, /\.rpc\("join_team_by_code", \{ p_code: code \}\)/);
  assert.match(codeJoin, /<label htmlFor=\{inputId\}/);
  assert.match(codeJoin, /Enter team code/);
  assert.match(codeJoin, /text-slate-900/);
  assert.match(codeJoin, /bg-white/);
  assert.match(codeJoin, /role="alert"/);
  assert.match(codeJoin, /autoComplete="off"/);
  assert.match(setup, /<TeamCodeJoin/);
  assert.match(soloCard, /<TeamCodeJoin/);
});

test("invite note and Need help describe both joining options", () => {
  assert.match(dashboard, /enter team code <strong>\{team\.join_code\}<\/strong>/);
  assert.match(help, /pick a team from the list or select Enter team code and paste the code a teammate sent you/);
  assert.doesNotMatch(help, /No invite code is needed/);
});

test("code join errors are explained in plain language", () => {
  assert.equal(
    friendlyError({ message: "No team matches that code." }),
    "No team matches that code. Check the code with your teammate and try again."
  );
  assert.equal(
    friendlyError({ message: "Leave your current team before joining another team." }),
    "You're already on a team. Leave your current team before joining another one."
  );
});
