export interface ActivitySummaryInput {
  activity: string;
  minutes: number;
}

export interface ActivityTypeSummary {
  activity: string;
  entries: number;
  totalMinutes: number;
  averageMinutes: number;
  percentOfTime: number;
}

export function summarizeActivitiesByType(
  activities: ActivitySummaryInput[],
  limit = 10
): ActivityTypeSummary[] {
  const totalActivityMinutes = activities.reduce((sum, activity) => sum + activity.minutes, 0);
  const grouped = new Map<string, { entries: number; totalMinutes: number }>();

  for (const activity of activities) {
    const current = grouped.get(activity.activity) ?? { entries: 0, totalMinutes: 0 };
    current.entries += 1;
    current.totalMinutes += activity.minutes;
    grouped.set(activity.activity, current);
  }

  return [...grouped.entries()]
    .map(([activity, totals]) => ({
      activity,
      entries: totals.entries,
      totalMinutes: totals.totalMinutes,
      averageMinutes: Math.round(totals.totalMinutes / totals.entries),
      percentOfTime:
        totalActivityMinutes > 0
          ? Math.round((totals.totalMinutes / totalActivityMinutes) * 100)
          : 0,
    }))
    .sort(
      (a, b) =>
        b.entries - a.entries ||
        b.totalMinutes - a.totalMinutes ||
        a.activity.localeCompare(b.activity)
    )
    .slice(0, limit);
}
