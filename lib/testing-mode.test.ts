import test from "node:test";
import assert from "node:assert/strict";
import { isTestingModeActive, reginaDateIso, TESTING_MODE_END_DATE } from "./testing-mode";
import { todayIso } from "./constants";

test("testing mode remains active through August 31 when configured", () => {
  assert.equal(TESTING_MODE_END_DATE, "2026-09-01");
  assert.equal(isTestingModeActive(true, "2026-08-31"), true);
});

test("testing mode shuts off automatically on September 1", () => {
  assert.equal(isTestingModeActive(true, "2026-09-01"), false);
  assert.equal(isTestingModeActive(true, "2026-10-05"), false);
});

test("testing mode stays off when the environment flag is disabled", () => {
  assert.equal(isTestingModeActive(false, "2026-08-31"), false);
});

test("Regina date conversion uses Saskatchewan time at the UTC boundary", () => {
  assert.equal(reginaDateIso(new Date("2026-09-01T05:59:59Z")), "2026-08-31");
  assert.equal(reginaDateIso(new Date("2026-09-01T06:00:00Z")), "2026-09-01");
});

test("todayIso opens Week 1 at 12:00am Saskatchewan time on October 5", () => {
  // 05:59:59 UTC = 23:59:59 Oct 4 in Regina (UTC-6) -> still pre-challenge.
  assert.equal(todayIso(new Date("2026-10-05T05:59:59Z")), "2026-10-04");
  // 06:00:00 UTC = 00:00:00 Oct 5 in Regina -> challenge opens.
  assert.equal(todayIso(new Date("2026-10-05T06:00:00Z")), "2026-10-05");
});
