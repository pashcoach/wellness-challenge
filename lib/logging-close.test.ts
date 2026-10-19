import test from "node:test";
import assert from "node:assert/strict";
import { challengePhase } from "./constants";
import { isLoggingClosed, LOGGING_CLOSE_AT } from "./logging-close";
import { friendlyError } from "./errors";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ActivityForm from "../components/ActivityForm";
import WellnessCheckin from "../components/WellnessCheckin";
import EntryLog from "../components/EntryLog";
import type { Profile } from "./data";

const message = "The FCL Challenge is officially over. Thank you for participating in the challenge! You are awesome 🙌.";

test("logging forms remain available at noon and just before midnight on the final day", (t) => {
  for (const now of ["2026-10-30T18:00:00Z", "2026-10-31T05:59:59.999Z"]) {
    t.mock.timers.enable({ apis: ["Date"], now: new Date(now) });
    const profile = { id: "test-user" } as Profile;
    for (const html of [
      renderToStaticMarkup(createElement(ActivityForm, { profile, onLogged() {} })),
      renderToStaticMarkup(createElement(WellnessCheckin, { profile, week: 4, existing: undefined, onLogged() {} })),
    ]) {
      assert.ok(html.includes("<form"));
      assert.ok(!html.includes(message));
    }
    t.mock.timers.reset();
  }
});

test("closed activity and check-in surfaces replace submission controls with the approved message", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-31T06:00:00Z") });
  const profile = { id: "test-user" } as Profile;
  const activity = renderToStaticMarkup(createElement(ActivityForm, { profile, onLogged() {} }));
  const checkin = renderToStaticMarkup(createElement(WellnessCheckin, { profile, week: 4, existing: undefined, onLogged() {} }));
  for (const html of [activity, checkin]) {
    assert.ok(html.includes(message));
    assert.ok(!html.includes("<form"));
  }
});

test("closed entry history stays readable but has no edit or delete controls", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-31T06:00:00Z") });
  const html = renderToStaticMarkup(createElement(EntryLog, {
    activities: [{ id: "test", user_id: "test-user", activity: "Walking", minutes: 10, points: 10, week: 4, entry_date: "2026-10-30", created_at: "2026-10-30T18:00:00Z" }],
    checkins: [], onChanged() {},
  }));
  assert.ok(html.includes("Walking"));
  assert.ok(!html.includes('title="Edit entry"'));
  assert.ok(!html.includes('title="Delete entry"'));
  assert.ok(!html.includes("Tap ✏️"));
});

test("all write handlers re-check closure at submission and dashboard suppresses logging nudges", () => {
  const activity = readFileSync("components/ActivityForm.tsx", "utf8");
  const checkin = readFileSync("components/WellnessCheckin.tsx", "utf8");
  const log = readFileSync("components/EntryLog.tsx", "utf8");
  const dashboard = readFileSync("components/Dashboard.tsx", "utf8");
  assert.equal((activity.match(/if \(isLoggingClosed\(\)\)/g) ?? []).length, 2);
  assert.equal((checkin.match(/if \(isLoggingClosed\(\)\)/g) ?? []).length, 1);
  assert.equal((log.match(/if \(isLoggingClosed\(\)\)/g) ?? []).length, 3);
  assert.match(dashboard, /!loggingClosed && !futureWeekLocked/);
  assert.match(dashboard, /loggingClosed \? <ChallengeClosed/);
});

test("fresh installations enforce the same database close and recap uses the approved message", () => {
  const schema = readFileSync("supabase/schema.sql", "utf8");
  const migration = readFileSync("supabase/migration-challenge-logging-close.sql", "utf8");
  assert.ok(schema.includes(migration.trim()));
  assert.match(readFileSync("app/wrap-up/page.tsx", "utf8"), /\{CHALLENGE_CLOSED_MESSAGE\}/);
});

test("stale clients receive the approved closure message for a database rejection", () => {
  assert.equal(friendlyError({ code: "P0001", message: "Challenge logging is closed." }), message);
});

test("cutoff is exclusive and timezone-independent at the millisecond boundary", () => {
  assert.equal(new Date(LOGGING_CLOSE_AT).toISOString(), "2026-10-31T06:00:00.000Z");
  assert.equal(isLoggingClosed(new Date("2026-10-30T12:00:00-06:00")), false);
  assert.equal(isLoggingClosed(new Date("2026-10-30T23:59:59.999-06:00")), false);
  assert.equal(isLoggingClosed(new Date("2026-10-31T00:00:00-06:00")), true);
  assert.equal(isLoggingClosed(new Date("2026-10-31T06:00:00.001Z")), true);
});

test("logging remains active through Oct 30 and closes at midnight starting Oct 31 in Regina", () => {
  assert.equal(challengePhase(new Date("2026-10-30T18:00:00Z")), "active");
  assert.equal(challengePhase(new Date("2026-10-31T05:59:59.999Z")), "active");
  assert.equal(challengePhase(new Date("2026-10-31T06:00:00.000Z")), "post");
  assert.equal(challengePhase(new Date("2026-10-31T06:00:00.001Z")), "post");
});
