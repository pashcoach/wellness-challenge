/** Translate raw Postgres / network errors into user-friendly messages.
 *  Logs the original error details to the console for debugging. */
export function friendlyError(err: unknown): string {
  const msg = extractMessage(err);
  console.error("[friendlyError]", msg, err);

  // Postgres error codes
  const code = (err as any)?.code;
  if (code === "23505") {
    if (/wellness_checkins/.test(msg)) return "You've already checked in this week. Nice work!";
    if (/teams_join_code/.test(msg)) return "That team code was already taken — try again.";
    if (/survey_responses/.test(msg)) return "You've already submitted the survey. Thanks!";
    return "A record with those details already exists.";
  }
  if (code === "23503") return "Couldn't save — the related record wasn't found.";
  if (code === "23502") return "Some required information is missing.";
  if (code === "42P01") return "A database table is missing — check the schema.";
  if (code === "42501") return "You don't have permission to do that.";

  // Network / HTTP errors
  if (/Failed to fetch/i.test(msg) || /NetworkError/i.test(msg) || /TypeError/i.test(msg))
    return "Couldn't reach the server — check your connection and try again.";
  if (/timeout/i.test(msg) || /timed ?out/i.test(msg))
    return "The request timed out — please try again.";
  if (/abort/i.test(msg))
    return "The request was cancelled.";

  // Auth errors
  if (/Invalid login credentials/i.test(msg))
    return "That email or password isn't correct. Try again or reset your password.";
  if (/Email not confirmed/i.test(msg))
    return "Please check your email for the confirmation link before signing in.";
  if (/User already registered/i.test(msg))
    return "An account with that email already exists. Try signing in instead.";
  if (/Password should be/i.test(msg))
    return "Password must be at least 6 characters.";

  // Fallback
  return "Something went wrong. Please try again — if it keeps happening, let Patrick know.";
}

function extractMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
    if (typeof e.error_description === "string") return e.error_description;
    if (typeof e.error === "string") return e.error;
    if (typeof e.statusText === "string") return e.statusText;
  }
  return String(err);
}
