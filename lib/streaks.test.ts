import assert from "node:assert/strict";
import test from "node:test";
// Node's native TypeScript runner requires the extension; production uses bundler resolution.
// @ts-expect-error TS5097
import { computeActivityStreak, computeCheckinStreak } from "./streaks.ts";
import type { ActivityEntry, WellnessCheckin } from "./data";
import { todayIso } from "./constants";

function localDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

function addDays(date: string, days: number): string {
  const result = localDate(date);
  result.setDate(result.getDate() + days);
  return todayIso(result);
}

function mostRecentMonday(): string {
  const today = new Date(`${todayIso()}T12:00:00`);
  const daysSinceMonday = (today.getDay() + 6) % 7;
  today.setDate(today.getDate() - daysSinceMonday);
  return todayIso(today);
}

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

test("activity streak treats Friday through Monday as consecutive weekdays", () => {
  const monday = mostRecentMonday();
  const entries = [activity(monday), activity(addDays(monday, -3))];

  assert.deepEqual(computeActivityStreak(entries), { current: 2, longest: 2 });
});

test("activity streak counts each active calendar day once and ignores weekends", () => {
  const monday = mostRecentMonday();
  const entries = [
    activity(monday, "monday-1"),
    activity(monday, "monday-2"),
    activity(addDays(monday, -1), "sunday"),
    activity(addDays(monday, -3), "friday"),
    activity(addDays(monday, -4), "thursday"),
  ];

  assert.deepEqual(computeActivityStreak(entries), { current: 3, longest: 3 });
});

test("activity streak reports the latest run as current and a previous longer run as longest", () => {
  const monday = mostRecentMonday();
  const entries = [
    activity(monday),
    activity(addDays(monday, -3)),
    activity(addDays(monday, -7)),
    activity(addDays(monday, -10)),
    activity(addDays(monday, -11)),
  ];

  assert.deepEqual(computeActivityStreak(entries), { current: 2, longest: 3 });
});

test("check-in streak deduplicates weeks and tracks current and longest runs", () => {
  const entries = [checkin(1), checkin(2), checkin(2, "2-duplicate"), checkin(4), checkin(5)];

  assert.deepEqual(computeCheckinStreak(entries), { current: 2, longest: 2 });
});

test("empty streak inputs return zeroes", () => {
  assert.deepEqual(computeActivityStreak([]), { current: 0, longest: 0 });
  assert.deepEqual(computeCheckinStreak([]), { current: 0, longest: 0 });
});
