/** Activity-time guidance and audit helpers. */

export const DAILY_ACTIVITY_REVIEW_MINUTES = 240;
export const LONG_ENTRY_FLAG_MINUTES = 180;

export const ACTIVITY_LOGGING_HINT =
  "Log only intentional wellness activity time, like a workout, walk, stretching, or meditation—not a work shift or all-day steps. You can enter several days at once; choose the date it happened for each activity.";

export const ACTIVITY_TIME_FAQ = {
  question: "What counts as activity time?",
  answer:
    "Log only the minutes you spend on an intentional wellness activity, such as a workout, walk, run, bike ride, stretching, yoga, or meditation. Please don't log a full work shift, time on your feet at work, or all-day step counts.\n\n" +
    "You may enter several days—or your whole week—in a single sitting. Please make a separate entry for each activity and select the actual date it happened rather than combining the week's minutes under one day. To keep the challenge fair for everyone, the app team reviews unusually large entries and may contact you privately to confirm or correct one.",
} as const;

export function auditReasons(day: { dayMinutes: number; maxEntryMinutes: number }): string[] {
  const reasons: string[] = [];
  if (day.dayMinutes > DAILY_ACTIVITY_REVIEW_MINUTES) reasons.push("More than 240 minutes in one day");
  if (day.maxEntryMinutes > LONG_ENTRY_FLAG_MINUTES) reasons.push("Single entry over 180 minutes");
  return reasons;
}

export function validateAdjustedMinutes(currentMinutes: number, nextMinutes: number): string | null {
  if (!Number.isInteger(nextMinutes) || nextMinutes < 1) return "Enter a whole number of minutes, 1 or more.";
  if (nextMinutes >= currentMinutes) return "Enter fewer minutes than the current entry.";
  return null;
}

function longDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function auditRequestEmail(input: { firstName: string; entryDate: string; dayMinutes: number }) {
  const date = longDate(input.entryDate);
  const subject = `FCL Wellness Challenge: quick check on your ${date} activity`;
  const body = [
    `Hi ${input.firstName},`,
    "",
    `Thanks for jumping into the FCL Wellness Challenge! As part of a routine accuracy check we do for everyone, we noticed ${input.dayMinutes} minutes of activity logged for ${date}.`,
    "",
    "Could you take a moment to review it? If any of it was an entry mistake, or included time like a work shift or all-day steps, you can fix it yourself in the app. There's no penalty for an honest mistake.",
    "",
    "How to edit or delete an entry:",
    "1. Sign in at https://fclwellnesschallengeapp.ca",
    '2. Scroll down to "My entry log".',
    `3. Find your ${date} entry.`,
    '4. To change it: tap the pencil icon (✏️), update the Minutes, and tap "Save changes".',
    '5. To remove it: tap the trash icon (🗑️), then tap "Delete" to confirm.',
    "Your points and the leaderboards update right away.",
    "",
    "If the entry is accurate, just reply to this email and let us know what the activity was and roughly how long it lasted.",
    "",
    "Activity time is intentional wellness activity (workouts, walks, stretching, meditation, and similar). You can enter several days at once; just make a separate entry with the actual date for each activity.",
    "",
    "Thanks for helping keep the challenge fair for everyone!",
    "",
    "Patrick Ash",
    "Endurance Journey, on behalf of the FCL Wellness Challenge",
  ].join("\n");
  return { subject, body };
}
