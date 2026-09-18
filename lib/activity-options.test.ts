import test from "node:test";
import assert from "node:assert/strict";
import { ACTIVITIES } from "./constants";

test('the "Other" activity choice is listed last', () => {
  assert.equal(ACTIVITIES.at(-1), "Other");
});
