import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const feedbackSource = readFileSync(new URL("../components/FeedbackButton.tsx", import.meta.url), "utf8");
const authSource = readFileSync(new URL("../components/AuthForm.tsx", import.meta.url), "utf8");

test("production feedback is not marked as test data", () => {
  assert.doesNotMatch(feedbackSource, /\[TEST FEEDBACK\]/);
});

test("signed-out email recovery does not query participant profiles", () => {
  assert.doesNotMatch(authSource, /\.from\("profiles"\)[\s\S]*?\.ilike\("full_name"/);
});
