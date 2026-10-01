import assert from "node:assert/strict";
import test from "node:test";
import { parsePasswordRecoveryHash, passwordRecoveryDestination } from "./password-recovery";

test("parses recovery tokens from a Supabase redirect hash", () => {
  assert.deepEqual(
    parsePasswordRecoveryHash(
      "#access_token=access-123&refresh_token=refresh-456&type=recovery&expires_in=3600"
    ),
    {
      kind: "tokens",
      accessToken: "access-123",
      refreshToken: "refresh-456",
    }
  );
});

test("returns a clear message when Supabase reports an expired recovery link", () => {
  assert.deepEqual(
    parsePasswordRecoveryHash(
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
    ),
    {
      kind: "error",
      message: "This password reset link is invalid or has expired. Please request a new one.",
    }
  );
});

test("returns none when the URL has no recovery information", () => {
  assert.deepEqual(parsePasswordRecoveryHash(""), { kind: "none" });
});

test("routes a recovery event from the app root to the reset page", () => {
  assert.equal(passwordRecoveryDestination("PASSWORD_RECOVERY", "/"), "/reset-password");
});

test("does not redirect normal auth events or a recovery already on the reset page", () => {
  assert.equal(passwordRecoveryDestination("SIGNED_IN", "/"), null);
  assert.equal(passwordRecoveryDestination("PASSWORD_RECOVERY", "/reset-password"), null);
});
