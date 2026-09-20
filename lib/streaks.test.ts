import assert from "node:assert/strict";
import test from "node:test";
// Node's native TypeScript runner requires the extension; production uses bundler resolution.
// @ts-expect-error TS5097
import { computeActivityStreak, computeCheckinStreak } from "./streaks.ts";
import type { ActivityEntry, WellnessCheckin } from "./data";

function activity(entry_date: string, id = entry_date): ActivityEntry {
  return {
    id,
    user_id: "user",
    activity: "Walking",
    minutes: 10,
    points: 10,
    entry_date,
    week: 1,
    created_at: `${entry_date}T12:00:00Z`,
  };
}

function checkin(week: number, id = String(week)): WellnessCheckin {
  return {
    id,
    user_id: "user",
    week,
    pillar: "physical",
    comment: null,
    points: 20,
    entry_date: "2026-10-05",
    created_at: "2026-10-05T12:00:00Z",
  };
}

// Fixed "today" anchor so the streak tests are deterministic regardless of the
// real run date. 2026-10-12 is a Monday.
const TODAY_MON = "2026-10-12";

test("activity streak treats Friday through Monday as consecutive weekdays", () => {
  const entries = [activity("2026-10-12", "mon"), activity("2026-10-09", "fri")];

  assert.deepEqual(computeActivityStreak(entries, TODAY_MON), { current: 2, longest: 2 });
});

test("activity streak counts each active calendar day once and ignores weekends", () => {
  const entries = [
    activity("2026-10-12", "mon-1"),
    activity("2026-10-12", "mon-2"),
    activity("2026-10-09", "fri"),
    activity("2026-10-08", "thu"),
  ];

  assert.deepEqual(computeActivityStreak(entries, TODAY_MON), { current: 3, longest: 3 });
});

test("activity streak reports the latest run as current and a previous longer run as longest", () => {
  const entries = [
    activity("2026-10-12", "mon"),
    activity("2026-10-09", "fri"),
    activity("2026-10-05", "prior-mon"),
    activity("2026-10-02", "prior-fri"),
    activity("2026-10-01", "prior-thu"),
  ];

  assert.deepEqual(computeActivityStreak(entries, TODAY_MON), { current: 2, longest: 3 });
});

test("a week-old activity is not part of the current streak", () => {
  const entries = [activity("2026-10-02", "old"), activity("2026-10-01", "old-2")];

  assert.deepEqual(computeActivityStreak(entries, TODAY_MON), { current: 0, longest: 2 });
});

test("check-in streak deduplicates weeks and tracks current and longest runs", () => {
  const entries = [checkin(1), checkin(2), checkin(2, "2-duplicate"), checkin(4), checkin(5)];

  assert.deepEqual(computeCheckinStreak(entries), { current: 2, longest: 2 });
});

test("empty streak inputs return zeroes", () => {
  assert.deepEqual(computeActivityStreak([], TODAY_MON), { current: 0, longest: 0 });
  assert.deepEqual(computeCheckinStreak([]), { current: 0, longest: 0 });
});
