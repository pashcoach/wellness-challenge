import { CHALLENGE } from "./constants";

const WEEK_STARTS = [
  "2026-10-05",
  "2026-10-12",
  "2026-10-19",
  "2026-10-26",
] as const;

const WEEK_START_LABELS = [
  "October 5",
  "October 12",
  "October 19",
  "October 26",
] as const;

/** Highest challenge week that has opened on the supplied local ISO date. */
export function latestOpenChallengeWeek(dateIso: string): number {
  if (dateIso < CHALLENGE.startDate) return 0;
  if (dateIso >= WEEK_STARTS[3]) return 4;
  if (dateIso >= WEEK_STARTS[2]) return 3;
  if (dateIso >= WEEK_STARTS[1]) return 2;
  return 1;
}

export function isFutureChallengeWeek(week: number, dateIso: string): boolean {
  return week > latestOpenChallengeWeek(dateIso);
}

/** Last date accepted by the activity picker: today or challenge end, whichever is earlier. */
export function latestLoggableDate(dateIso: string): string {
  return dateIso < CHALLENGE.endDate ? dateIso : CHALLENGE.endDate;
}

export function challengeWeekStartDate(week: number): string {
  return WEEK_START_LABELS[Math.min(4, Math.max(1, week)) - 1];
}
