import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeUsername, publicNameAfterUsernameChange } from "./profile-settings";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("username changes trim the value and blank removes it", () => {
  assert.deepEqual(normalizeUsername("  Quadzilla  "), { ok: true, username: "Quadzilla" });
  assert.deepEqual(normalizeUsername("   "), { ok: true, username: null });
});

test("username changes enforce the same 20-character registration limit", () => {
  assert.deepEqual(normalizeUsername("x".repeat(20)), { ok: true, username: "x".repeat(20) });
  assert.deepEqual(normalizeUsername("x".repeat(21)), {
    ok: false,
    error: "Usernames can be up to 20 characters.",
  });
});

test("removing a username previews the privacy-safe fallback", () => {
  assert.equal(publicNameAfterUsernameChange("Patrick Ash", ""), "Patrick A.");
  assert.equal(publicNameAfterUsernameChange("Patrick Ash", " Pacho "), "Pacho");
});

test("dashboard exposes an accessible profile setting and refreshes public displays", () => {
  const settings = source("components/ProfileSettings.tsx");
  const dashboard = source("components/Dashboard.tsx");
  assert.match(settings, /<label[^>]*htmlFor="profile-username"/);
  assert.match(settings, /maxLength=\{USERNAME_MAX\}/);
  assert.match(settings, /\.update\(\{ username: checked\.username \}\)/);
  assert.match(settings, /Your points, activities, check-ins, badges, team, and prize eligibility will not change\./);
  assert.match(settings, /If removed, you will appear as/);
  assert.match(dashboard, /<ProfileSettings profile=\{profile\} onSaved=\{handleDataChanged\}/);
});
