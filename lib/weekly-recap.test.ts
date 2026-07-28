import assert from "node:assert/strict";
import test from "node:test";
// Node's native TypeScript runner requires the extension; production uses bundler resolution.
// @ts-expect-error TS5097
import { buildWeeklyRecap, shouldShowWeeklyRecap } from "./weekly-recap.ts";
import type { ActivityEntry, WellnessCheckin } from "./data";

function activity(
  week: number,
  entryDate: string,
  points: number,
  id = `${week}-${entryDate}-${points}`
): ActivityEntry {
  return {
    id,
    user_id: "user",
    activity: "Walking",
    minutes: points,
    points,
    entry_date: entryDate,
    week,
    created_at: `${entryDate}T12:00:00Z`,
  };
}

function checkin(week: number, points: number): WellnessCheckin {
  return {
    id: `checkin-${week}`,
    user_id: "user",
    week,
    pillar: "physical",
    comment: null,
    points,
    entry_date: "2026-10-05",
    created_at: "2026-10-05T12:00:00Z",
  };
}

test("weekly recap totals the prior two weeks and includes check-in points", () => {
  const recap = buildWeeklyRecap(
    [activity(1, "2026-10-05", 40), activity(2, "2026-10-12", 100)],
    [checkin(1, 20), checkin(2, 20)],
    3,
    4,
    180
  );

  assert.equal(recap.lastWeek.week, 2);
  assert.equal(recap.lastWeek.points, 120);
  assert.equal(recap.weekBefore.week, 1);
  assert.equal(recap.weekBefore.points, 60);
  assert.equal(recap.goalMet, false);
  assert.equal(recap.activityStreak, 4);
});

test("weekly recap aggregates same-day activities to find the best day", () => {
  const recap = buildWeeklyRecap(
    [
      activity(2, "2026-10-13", 40, "one"),
      activity(2, "2026-10-13", 50, "two"),
      activity(2, "2026-10-14", 80, "three"),
      activity(1, "2026-10-06", 200, "other-week"),
    ],
    [],
    3,
    2,
    170
  );

  assert.deepEqual(recap.bestDay, { date: "2026-10-13", points: 90 });
  assert.equal(recap.goalMet, true);
});

test("weekly recap calculates an achievable rounded-up weekly pace", () => {
  const recap = buildWeeklyRecap([], [], 3, 0, 201);

  assert.equal(recap.pointsToGo, 359);
  assert.equal(recap.remainingWeeks, 2);
  assert.equal(recap.pointsPerWeek, 180);
});

test("weekly recap clamps completed goals and recognizes a met weekly goal", () => {
  const recap = buildWeeklyRecap(
    [activity(3, "2026-10-19", 140)],
    [],
    4,
    1,
    600
  );

  assert.equal(recap.goalMet, true);
  assert.equal(recap.pointsToGo, 0);
  assert.equal(recap.pointsPerWeek, 0);
});

test("weekly recap is gated by the display week stored in local storage", () => {
  assert.equal(shouldShowWeeklyRecap(null, 1), false);
  assert.equal(shouldShowWeeklyRecap(null, 2), true);
  assert.equal(shouldShowWeeklyRecap("1", 2), true);
  assert.equal(shouldShowWeeklyRecap("2", 2), false);
});
