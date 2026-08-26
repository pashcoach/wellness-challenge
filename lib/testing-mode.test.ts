import test from "node:test";
import assert from "node:assert/strict";
import { isTestingModeActive, reginaDateIso, TESTING_MODE_END_DATE } from "./testing-mode";

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
