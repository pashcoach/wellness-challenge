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

test("explains when team changes are locked", () => {
  assert.equal(
    friendlyError({ message: "Team changes are locked after your first wellness activity or weekly check-in." }),
    "Team changes are locked because you have already made your first entry in the app by logging a wellness activity or completing the Weekly Wellness section. Contact Patrick if a correction is needed."
  );
});

test("explains why a creator cannot delete a team with other members", () => {
  assert.equal(
    friendlyError({ message: "This team cannot be deleted until you are its only remaining member." }),
    "You can delete this team only after all other members have left."
  );
});
