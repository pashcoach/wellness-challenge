import { CHALLENGE } from "./constants";
import type { ActivityEntry, WellnessCheckin } from "./data";

export interface WeeklyRecapSummary {
  lastWeek: { week: number; points: number };
  weekBefore: { week: number; points: number };
  goalMet: boolean;
  bestDay: { date: string; points: number } | null;
  activityStreak: number;
  pointsToGo: number;
  remainingWeeks: number;
  pointsPerWeek: number;
}

function pointsForWeek(
  activities: ActivityEntry[],
  checkins: WellnessCheckin[],
  week: number
): number {
  const activityPoints = activities
    .filter((activity) => activity.week === week)
    .reduce((sum, activity) => sum + activity.points, 0);
  const checkinPoints = checkins
    .filter((checkin) => checkin.week === week)
    .reduce((sum, checkin) => sum + checkin.points, 0);
  return activityPoints + checkinPoints;
}

/**
 * Show the recap only when the tester/user advances to a week they haven't
 * seen a recap for yet. Switching back to an earlier tab never re-triggers it
 * (lastSeenWeek stores the highest week already shown).
 */
export function shouldShowWeeklyRecap(lastSeenWeek: string | null, displayWeek: number): boolean {
  const seen = lastSeenWeek === null ? 0 : parseInt(lastSeenWeek, 10);
  const seenNum = Number.isNaN(seen) ? 0 : seen;
  return displayWeek > 1 && displayWeek > seenNum;
}

/**
 * Build the recap shown in the pop-up.
 *
 * In production the pop-up reviews the *previous* completed week (displayWeek - 1),
 * which is how it read during the live challenge. In testing mode the "week" the
 * tester is looking at is arbitrary (dates map to weeks by day-of-month), so we
 * review the displayed week itself — otherwise testers always see an empty
 * "previous week" and think their points are missing.
 */
export function buildWeeklyRecap(
  activities: ActivityEntry[],
  checkins: WellnessCheckin[],
  displayWeek: number,
  activityStreak: number,
  totalPoints: number
): WeeklyRecapSummary {
  const reviewingWeek = CHALLENGE.testingMode ? displayWeek : displayWeek - 1;
  const weekBefore = reviewingWeek - 1;
  const reviewingPoints = pointsForWeek(activities, checkins, reviewingWeek);
  const pointsByDate = new Map<string, number>();

  for (const activity of activities) {
    if (activity.week !== reviewingWeek) continue;
    pointsByDate.set(activity.entry_date, (pointsByDate.get(activity.entry_date) ?? 0) + activity.points);
  }

  let bestDay: WeeklyRecapSummary["bestDay"] = null;
  for (const [date, points] of pointsByDate) {
    if (!bestDay || points > bestDay.points || (points === bestDay.points && date > bestDay.date)) {
      bestDay = { date, points };
    }
  }

  const challengeWeeks = Math.ceil(CHALLENGE.totalPointGoal / CHALLENGE.weeklyPointGoal);
  const remainingWeeks = Math.max(1, challengeWeeks - displayWeek + 1);
  const pointsToGo = Math.max(0, CHALLENGE.totalPointGoal - totalPoints);

  return {
    lastWeek: { week: reviewingWeek, points: reviewingPoints },
    weekBefore: { week: weekBefore, points: pointsForWeek(activities, checkins, weekBefore) },
    goalMet: reviewingPoints >= CHALLENGE.weeklyPointGoal,
    bestDay,
    activityStreak,
    pointsToGo,
    remainingWeeks,
    pointsPerWeek: Math.ceil(pointsToGo / remainingWeeks),
  };
}
