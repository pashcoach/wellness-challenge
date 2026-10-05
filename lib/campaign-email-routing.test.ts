import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migration-campaign-email-routing.sql", "utf8");
const schema = readFileSync("supabase/schema.sql", "utf8");
const fn = readFileSync("supabase/functions/wellness-participant-emails/index.ts", "utf8");

for (const [label, sql] of [["migration", migration], ["schema", schema]] as const) {
  test(`${label} keeps campaign routing private and operator-controlled`, () => {
    assert.match(sql, /create table if not exists public\.campaign_email_routing/);
    assert.match(sql, /email_override text/);
    assert.match(sql, /suppress boolean not null default false/);
    assert.match(sql, /alter table public\.campaign_email_routing enable row level security/);
    assert.match(sql, /revoke all on public\.campaign_email_routing from public, anon, authenticated/);
  });
}

test("participant-email function applies overrides and suppression", () => {
  assert.match(fn, /from\("campaign_email_routing"\)\.select\("user_id,email_override,suppress"\)/);
  assert.match(fn, /if \(route\?\.suppress\) return null/);
  assert.match(fn, /route\?\.email_override \?\? user\.email/);
  assert.match(fn, /\.filter\(\(email\): email is string => Boolean\(email\)\)/);
});
