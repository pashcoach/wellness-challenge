import assert from "node:assert/strict";
import test from "node:test";
// Node's native TypeScript runner requires the extension; production uses bundler resolution.
// @ts-expect-error TS5097
import { relativeTime } from "./team-feed.ts";

const now = new Date("2026-07-28T12:00:00Z");

test("relativeTime formats recent activity in compact units", () => {
  assert.equal(relativeTime("2026-07-28T11:59:31Z", now), "just now");
  assert.equal(relativeTime("2026-07-28T11:55:00Z", now), "5m ago");
  assert.equal(relativeTime("2026-07-28T10:00:00Z", now), "2h ago");
});

test("relativeTime formats prior days", () => {
  assert.equal(relativeTime("2026-07-27T10:00:00Z", now), "yesterday");
  assert.equal(relativeTime("2026-07-25T12:00:00Z", now), "3d ago");
});

test("relativeTime handles future or invalid timestamps gracefully", () => {
  assert.equal(relativeTime("2026-07-28T12:01:00Z", now), "just now");
  assert.equal(relativeTime("not-a-date", now), "just now");
});
