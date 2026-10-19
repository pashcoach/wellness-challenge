import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { isLoggingClosed, LOGGING_CLOSE_AT } from "./logging-close";

test("mounted logging clock closes at midnight, rechecks resumed tabs, and removes listeners", () => {
  const cutoff = Date.parse(LOGGING_CLOSE_AT);
  let now = cutoff - 1;
  let closed = false;
  let scheduled: { run: () => void; delay: number } | undefined;
  let cleanup: () => void = () => {};
  const focus = new Map<string, () => void>();
  const visibility = new Map<string, () => void>();
  const events = (map: Map<string, () => void>) => ({
    addEventListener: (event: string, callback: () => void) => map.set(event, callback),
    removeEventListener: (event: string) => map.delete(event),
  });
  const exports: { useLoggingClosed?: () => boolean } = {};
  const code = ts.transpileModule(readFileSync("lib/useLoggingClosed.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(code, {
    exports,
    require: (name: string) => name === "react" ? {
      useState: (init: () => boolean) => [init(), (value: boolean) => { closed = value; }],
      useEffect: (effect: () => () => void) => { cleanup = effect(); },
    } : { LOGGING_CLOSE_AT, isLoggingClosed: () => isLoggingClosed(new Date(now)) },
    Date: { now: () => now, parse: Date.parse },
    window: events(focus), document: events(visibility),
    setTimeout: (run: () => void, delay: number) => { scheduled = { run, delay }; return 1; },
    clearTimeout: () => { scheduled = undefined; },
  });
  assert.equal(exports.useLoggingClosed?.(), false);
  assert.equal(closed, false);
  assert.equal(scheduled?.delay, 1);
  now = cutoff;
  scheduled?.run();
  assert.equal(closed, true);
  assert.equal(scheduled, undefined);
  // A suspended tab must also recheck on focus/visibility rather than rely on
  // its original render or browser timer delivery.
  closed = false;
  focus.get("focus")?.();
  assert.equal(closed, true);
  closed = false;
  visibility.get("visibilitychange")?.();
  assert.equal(closed, true);
  cleanup();
  assert.equal(focus.size, 0);
  assert.equal(visibility.size, 0);
});
