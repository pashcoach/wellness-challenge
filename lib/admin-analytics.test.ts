import assert from "node:assert/strict";
import test from "node:test";

import { summarizeActivitiesByType } from "./admin-analytics";

test("summarizes activity entries, minutes, averages, and share of all activity time", () => {
  const summaries = summarizeActivitiesByType([
    { activity: "Walking", minutes: 30 },
    { activity: "Cycling", minutes: 60 },
    { activity: "Walking", minutes: 20 },
    { activity: "Walking", minutes: 40 },
  ]);

  assert.deepEqual(summaries, [
    { activity: "Walking", entries: 3, totalMinutes: 90, averageMinutes: 30, percentOfTime: 60 },
    { activity: "Cycling", entries: 1, totalMinutes: 60, averageMinutes: 60, percentOfTime: 40 },
  ]);
});

test("returns zero-safe percentages and limits the report to ten activities", () => {
  const activities = Array.from({ length: 12 }, (_, index) => ({
    activity: `Activity ${index + 1}`,
    minutes: 0,
  }));

  const summaries = summarizeActivitiesByType(activities);

  assert.equal(summaries.length, 10);
  assert.equal(summaries[0].percentOfTime, 0);
  assert.equal(summaries[0].averageMinutes, 0);
});
