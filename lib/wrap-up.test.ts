import assert from "node:assert/strict";
import test from "node:test";
// Node's native TypeScript runner requires the extension; production uses bundler resolution.
// @ts-expect-error TS5097
import { buildWrapUpStats, isWrapUpAvailable } from "./wrap-up.ts";
import type { ActivityEntry, WellnessCheckin } from "./data";

function activity(
  activityName: string,
  minutes: number,
  points: number,
  week: number,
  entryDate: string,
  id: string
): ActivityEntry {
  return {
    id,
    user_id: "user-1",
    activity: activityName,
    minutes,
    points,
    week,
    entry_date: entryDate,
    created_at: `${entryDate}T12:00:00Z`,
  };
}

function checkin(week: number, pillar: string, points = 20): WellnessCheckin {
  return {
    id: `checkin-${week}`,
    user_id: "user-1",
    week,
    pillar,
    comment: null,
    points,
    entry_date: `2026-10-${String(5 + (week - 1) * 7).padStart(2, "0")}`,
    created_at: "2026-10-05T12:00:00Z",
  };
}

test("wrap-up availability uses the America/Regina calendar date", () => {
  assert.equal(isWrapUpAvailable(new Date("2026-10-31T05:59:59Z")), false);
  assert.equal(isWrapUpAvailable(new Date("2026-10-31T06:00:00Z")), true);
});

test("wrap-up aggregates activity and check-in totals", () => {
  const stats = buildWrapUpStats(
    [
      activity("Walking", 30, 30, 1, "2026-10-05", "a1"),
      activity("Walking", 20, 20, 1, "2026-10-06", "a2"),
      activity("Yoga", 40, 40, 2, "2026-10-12", "a3"),
    ],
    [checkin(1, "physical"), checkin(2, "psychological")]
  );

  assert.equal(stats.totalPoints, 130);
  assert.equal(stats.totalMinutes, 90);
  assert.equal(stats.activityCount, 3);
  assert.equal(stats.checkinCount, 2);
  assert.equal(stats.mostFrequentActivity, "Walking");
  assert.deepEqual(stats.bestWeek, { week: 1, points: 70 });
  assert.equal(stats.pillarsCovered, 2);
});

test("wrap-up includes check-ins when choosing the best week and breaks ties by earliest week", () => {
  const stats = buildWrapUpStats(
    [
      activity("Cycling", 40, 40, 1, "2026-10-05", "a1"),
      activity("Running", 40, 40, 2, "2026-10-12", "a2"),
    ],
    [checkin(1, "physical"), checkin(2, "physical")]
  );

  assert.deepEqual(stats.bestWeek, { week: 1, points: 60 });
  assert.equal(stats.mostFrequentActivity, "Cycling");
  assert.equal(stats.pillarsCovered, 1);
});

test("wrap-up returns friendly empty-state values", () => {
  const stats = buildWrapUpStats([], []);

  assert.equal(stats.totalPoints, 0);
  assert.equal(stats.mostFrequentActivity, "None logged");
  assert.deepEqual(stats.bestWeek, { week: null, points: 0 });
  assert.equal(stats.pillarsCovered, 0);
});
