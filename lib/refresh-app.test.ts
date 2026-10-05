import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("dashboard provides a clearly labeled in-app refresh control", () => {
  const button = readFileSync(resolve(process.cwd(), "components/RefreshAppButton.tsx"), "utf8");
  const dashboard = readFileSync(resolve(process.cwd(), "components/Dashboard.tsx"), "utf8");

  assert.match(button, /window\.location\.reload\(\)/);
  assert.match(button, />Refresh</);
  assert.match(button, /aria-label="Refresh app"/);
  assert.match(dashboard, /<RefreshAppButton \/>/);
  assert.match(dashboard, /<header className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"/);
  assert.match(dashboard, /className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end"/);
});
