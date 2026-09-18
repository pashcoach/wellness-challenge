import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("service worker uses a fresh cache and network-first navigation", () => {
  const serviceWorker = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
  assert.match(serviceWorker, /const CACHE = "wellness-v5";/);
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/);
  assert.match(serviceWorker, /fetch\(event\.request\)[\s\S]*caches\.match\(event\.request\)/);
});

test("welcome video URL is versioned when its narration changes", () => {
  const component = readFileSync(resolve(process.cwd(), "components/WelcomeVideo.tsx"), "utf8");
  assert.match(component, /src="\/welcome\.mp4\?v=patrick-voice-1"/);
});
