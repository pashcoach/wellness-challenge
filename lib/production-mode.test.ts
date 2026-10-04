import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const constantsSource = readFileSync(new URL("./constants.ts", import.meta.url), "utf8");

test("production challenge configuration permanently disables testing mode", () => {
  assert.match(constantsSource, /testingMode:\s*false/);
  assert.doesNotMatch(constantsSource, /NEXT_PUBLIC_TESTING_MODE/);
});
