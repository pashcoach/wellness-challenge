export type PasswordRecoveryRedirect =
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "error"; message: string }
  | { kind: "none" };

const EXPIRED_MESSAGE =
  "This password reset link is invalid or has expired. Please request a new one.";

export type PasswordRecoveryCode =
  | { ok: true; code: string }
  | { ok: false; message: string };

export function isPasswordRecoveryCodeMode(search: string): boolean {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("code") === "1";
}

export function parsePasswordRecoveryCode(input: string): PasswordRecoveryCode {
  const code = input.replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(code)) {
    return { ok: false, message: "Enter the numeric code from your newest reset email." };
  }
  return { ok: true, code };
}

export function passwordRecoveryDestination(event: string, pathname: string): string | null {
  return event === "PASSWORD_RECOVERY" && pathname !== "/reset-password"
    ? "/reset-password"
    : null;
}

/**
 * Reads the URL fragment returned by Supabase's client-side recovery flow.
 * Parsing this ourselves makes recovery reliable even when automatic session
 * detection races React mounting, and lets us show redirect errors instead of
 * leaving the participant on an endless "Verifying" screen.
 */
export function parsePasswordRecoveryHash(hash: string): PasswordRecoveryRedirect {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const error = params.get("error");
  const errorCode = params.get("error_code");

  if (error || errorCode) {
    return { kind: "error", message: EXPIRED_MESSAGE };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    return { kind: "tokens", accessToken, refreshToken };
  }

  return { kind: "none" };
}
