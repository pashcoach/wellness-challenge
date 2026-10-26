/** Exclusive cutoff: noon Friday October 30 in America/Regina (UTC−06). */
export const LOGGING_CLOSE_AT = "2026-10-30T12:00:00-06:00";
export const CHALLENGE_CLOSED_MESSAGE = "The FCL Challenge is officially over. Thank you for participating in the challenge! You are awesome 🙌.";

export function isLoggingClosed(now = new Date()): boolean {
  return now.getTime() >= Date.parse(LOGGING_CLOSE_AT);
}
