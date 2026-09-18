import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("service worker uses a fresh cache and network-first navigation", () => {
  const serviceWorker = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
  assert.match(serviceWorker, /const CACHE = "wellness-v4";/);
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/);
  assert.match(serviceWorker, /fetch\(event\.request\)[\s\S]*caches\.match\(event\.request\)/);
});
