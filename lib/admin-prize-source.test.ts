import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminSource = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");

test("admin prize history reads the named draw-results view", () => {
  assert.match(adminSource, /from\("draw_results_view"\)/);
  assert.doesNotMatch(adminSource, /from\("draw_results"\)\.select\("\*"\)/);
});

test("admin prize history keys support multiple winners in one draw", () => {
  assert.match(adminSource, /key=\{d\.id\}/);
});
