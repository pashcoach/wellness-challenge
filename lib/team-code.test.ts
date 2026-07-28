import assert from "node:assert/strict";
import test from "node:test";
import { teamJoinCodeFromUuid } from "./team-code";

test("teamJoinCodeFromUuid creates the six-character uppercase code required by the database", () => {
  assert.equal(
    teamJoinCodeFromUuid("ab12cd34-5678-90ef-ab12-cd34567890ef"),
    "AB12CD"
  );
});

test("teamJoinCodeFromUuid rejects input that cannot produce a complete code", () => {
  assert.throws(() => teamJoinCodeFromUuid("abc"), /six characters/i);
});
