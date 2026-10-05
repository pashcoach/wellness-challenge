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
    "Team changes are locked because you have already made your first entry in the app by logging a wellness activity or completing the Weekly Wellness section. Use Need help to leave a message for the app team to assist with this correction."
  );
});

test("explains the Week 1 cutoff for a locked solo participant", () => {
  assert.equal(
    friendlyError({ message: "Joining a team after your first entry is only available to solo participants during Week 1." }),
    "After your first entry, a solo participant can join an existing team only through October 11. Use Need help to ask the app team for assistance."
  );
});

test("explains why a creator cannot delete a team with other members", () => {
  assert.equal(
    friendlyError({ message: "This team cannot be deleted until you are its only remaining member." }),
    "You can delete this team only after all other members have left."
  );
});
