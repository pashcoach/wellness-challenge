import assert from "node:assert/strict";
import test from "node:test";
import { friendlyError } from "./errors";

test("explains that a reset password must be different from the current password", () => {
  assert.equal(
    friendlyError({
      code: "same_password",
      message: "New password should be different from the old password.",
    }),
    "Your new password must be different from your current password."
  );
});
