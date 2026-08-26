import test from "node:test";
import assert from "node:assert/strict";
import {
  latestOpenChallengeWeek,
  isFutureChallengeWeek,
  latestLoggableDate,
  challengeWeekStartDate,
} from "./week-access";

test("only the current and past weeks are open during the challenge", () => {
  assert.equal(latestOpenChallengeWeek("2026-10-04"), 0);
  assert.equal(latestOpenChallengeWeek("2026-10-05"), 1);
  assert.equal(latestOpenChallengeWeek("2026-10-11"), 1);
  assert.equal(latestOpenChallengeWeek("2026-10-12"), 2);
  assert.equal(latestOpenChallengeWeek("2026-10-19"), 3);
  assert.equal(latestOpenChallengeWeek("2026-10-26"), 4);
  assert.equal(latestOpenChallengeWeek("2026-11-02"), 4);
});

test("future weeks are locked while earlier weeks remain available", () => {
  assert.equal(isFutureChallengeWeek(2, "2026-10-11"), true);
  assert.equal(isFutureChallengeWeek(1, "2026-10-11"), false);
  assert.equal(isFutureChallengeWeek(1, "2026-10-12"), false);
  assert.equal(isFutureChallengeWeek(2, "2026-10-12"), false);
  assert.equal(isFutureChallengeWeek(3, "2026-10-12"), true);
});

test("activity date picker never permits a future challenge date", () => {
  assert.equal(latestLoggableDate("2026-10-12"), "2026-10-12");
  assert.equal(latestLoggableDate("2026-11-02"), "2026-10-30");
  assert.equal(latestLoggableDate("2026-10-01"), "2026-10-01");
});

test("future-week lock messages use the correct opening dates", () => {
  assert.equal(challengeWeekStartDate(1), "October 5");
  assert.equal(challengeWeekStartDate(2), "October 12");
  assert.equal(challengeWeekStartDate(3), "October 19");
  assert.equal(challengeWeekStartDate(4), "October 26");
});
