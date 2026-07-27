export const CHALLENGE = {
  name: "Wellness Challenge 2026",
  org: "Federated Co-operatives Limited",
  startDate: "2026-10-05",
  endDate: "2026-10-30",
  /** TESTING MODE: true = any date can be logged (mapped into the challenge).
   *  Set to false before the real October launch! */
  testingMode: true,
  weeklyPointGoal: 140,
  totalPointGoal: 560,
  pointsPerTenMinutes: 10,
  wellnessCheckInPoints: 20,
} as const;

export const PILLARS = [
  {
    key: "physical",
    label: "Physical Wellness",
    prompt: "Take care of your physical health this week",
    examples: [
      "Increase your water intake to stay hydrated",
      "Take a daily stretch break during work hours",
      "Find a new healthy recipe to make",
    ],
  },
  {
    key: "psychological",
    label: "Psychological Wellness",
    prompt: "Take care of your psychological health this week",
    examples: [
      "Take a meditation break daily",
      "Start or end your day by naming three things you are grateful for",
      "Watch a webinar or read an article on HomeWeb (Homewood Health) or Wellness Now (Co-operators)",
    ],
  },
  {
    key: "financial",
    label: "Financial Wellness",
    prompt: "Take care of your financial health this week",
    examples: [
      "Create a personal budget (or update a current one)",
      "Check out options to save money through employee programs",
      "Watch a webinar or read an article on financial wellbeing",
    ],
  },
  {
    key: "social",
    label: "Social Wellness",
    prompt: "Take care of your social health this week",
    examples: [
      "Connect or schedule a coffee/tea meetup with a colleague",
      "Call a friend or family member you don't regularly talk to",
      "Volunteer in your community (remember: 2 paid volunteer days per year!)",
    ],
  },
] as const;

export const ACTIVITIES = [
  "Walking",
  "Strength Training",
  "Running",
  "Cycling",
  "Hiking",
  "Yoga",
  "High Intensity Interval Training",
  "Fitness Class",
  "Swimming",
  "Volleyball",
  "Dance Lessons",
  "Golf",
  "Martial Arts",
  "Elliptical",
  "Pilates",
  "Curling",
  "Hockey",
  "Rowing",
  "Pickleball",
  "Boxing",
  "Gardening",
  "Yardwork",
  "Stretching / Tai Chi",
  "Climbing",
  "Skateboarding",
  "Housework",
  "Playing with kids",
  "Other",
] as const;

export const BUSINESS_UNITS = [
  "Energy and Ag",
  "Co-Op Refinery Manufacturing",
  "Supply Chain",
  "People and Culture",
  "Co-Op and External Relations",
  "Consumer Products",
  "Finance",
  "Health and Safety Compliance",
  "Technology",
  "FCL Manufacturing",
] as const;

export const AGE_RANGES = ["18–29", "30–39", "40–49", "50–59", "60–69", "70–79"] as const;

/** Master list of wellness check-in activities — available every week, any pillar. */
export const WELLNESS_ACTIVITIES = [
  // Physical wellness
  "Increased my water intake",
  "Took a daily stretch break",
  "Tried a new healthy recipe",
  "Got a good night's sleep",
  "Meal prepped for the week",
  // Psychological wellness
  "Took a meditation break",
  "Practiced gratitude (named three things)",
  "Read an article or watched a wellness webinar",
  "Read a book for pleasure",
  "Took a proper break / unplugged",
  // Financial wellness
  "Created or updated my budget",
  "Checked out employee savings programs",
  "Read/watched something on financial wellbeing",
  "Reviewed my subscriptions or spending",
  "Set a savings goal",
  // Social wellness
  "Coffee/tea meetup with a colleague",
  "Called a friend or family member",
  "Volunteered (or signed up to volunteer)",
  "Did an act of kindness",
  "Joined a club, team, or community event",
  // Anything else
  "Other",
] as const;

export function pointsForMinutes(minutes: number): number {
  return Math.floor(minutes / 10) * CHALLENGE.pointsPerTenMinutes;
}

export function getChallengeWeek(dateStr: string): number | null {
  if (CHALLENGE.testingMode) {
    // In testing mode any date is accepted; map everything into the current
    // "testing week" (always week 1–4 based on day of month so testers can
    // see different weeks by picking different dates).
    const day = new Date(dateStr + "T12:00:00").getDate();
    return Math.min(4, Math.floor((day - 1) / 7) + 1);
  }
  const d = new Date(dateStr + "T12:00:00");
  const start = new Date(CHALLENGE.startDate + "T00:00:00");
  const end = new Date(CHALLENGE.endDate + "T23:59:59");
  if (d < start || d > end) return null;
  const dayIndex = Math.floor((d.getTime() - start.getTime()) / 86400000);
  return Math.min(4, Math.floor(dayIndex / 7) + 1);
}

export function pillarForWeek(week: number) {
  return PILLARS[Math.min(4, Math.max(1, week)) - 1];
}

/** Today's date in YYYY-MM-DD using local (America/Regina) timezone.
 *  Saskatchewan is UTC-6 year-round (no DST). Using Date's local methods
 *  avoids the 6pm rollover bug where .toISOString() advances to tomorrow. */
export function todayIso(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function currentChallengeWeek(today = new Date()): number | null {
  const iso = todayIso(today);
  return getChallengeWeek(iso);
}
