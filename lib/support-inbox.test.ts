import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { supportMessagesForView } from "./support-inbox";

const adminSource = readFileSync("app/admin/page.tsx", "utf8");

test("active support view excludes resolved messages", () => {
  const messages = [
    { id: "new", status: "new" as const },
    { id: "working", status: "in_progress" as const },
    { id: "done", status: "resolved" as const },
  ];

  assert.deepEqual(
    supportMessagesForView(messages, "active").map((message) => message.id),
    ["new", "working"],
  );
});

test("archived support view contains only resolved messages", () => {
  const messages = [
    { id: "new", status: "new" as const },
    { id: "done", status: "resolved" as const },
  ];

  assert.deepEqual(
    supportMessagesForView(messages, "archived").map((message) => message.id),
    ["done"],
  );
});

test("admin offers explicit resolve actions and never emails from the status selector", () => {
  assert.match(adminSource, /Resolve &amp; archive/);
  assert.match(adminSource, /Resolve &amp; send email/);
  assert.match(adminSource, /sends no email/i);
  assert.match(adminSource, /Archived \(/);
  assert.match(adminSource, /aria-pressed=\{supportView === "active"\}/);
  assert.match(adminSource, /aria-pressed=\{supportView === "archived"\}/);
  assert.doesNotMatch(adminSource, /<option value="resolved">Resolved<\/option>/);
  assert.match(adminSource, /resolveSupportRequest\(message\.id, false\)/);
  assert.match(adminSource, /resolveSupportRequest\(message\.id, true\)/);
});
