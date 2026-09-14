import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("service worker cache is bumped for the September production-mode release", () => {
  const serviceWorker = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
  assert.match(serviceWorker, /const CACHE = "wellness-v3";/);
});
