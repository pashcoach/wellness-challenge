export const supportInsightCategories = [
  "privacy_security",
  "account_access",
  "team_membership",
  "activity_points",
  "wellness_checkin",
  "bug_performance",
  "usability_content",
  "feature_request",
  "email_delivery",
  "other",
] as const;

export type SupportInsightCategory = (typeof supportInsightCategories)[number];
export type SupportInsightSource = "dashboard" | "gmail" | "both";
export type SupportInsightStatus = "open" | "in_progress" | "responded" | "resolved";
export type SupportInsightResponseChannel = "none" | "dashboard" | "gmail" | "both";

export interface SupportInsightRow {
  issue_key: string;
  source: SupportInsightSource;
  category: SupportInsightCategory;
  topic: string;
  first_seen: string;
  last_seen: string;
  status: SupportInsightStatus;
  response_sent: boolean;
  response_channel: SupportInsightResponseChannel;
  occurrence_count: number;
}

const CATEGORY_LABELS: Record<SupportInsightCategory, string> = {
  privacy_security: "Privacy & security",
  account_access: "Account access",
  team_membership: "Teams",
  activity_points: "Activities & points",
  wellness_checkin: "Weekly Wellness",
  bug_performance: "App bugs & performance",
  usability_content: "Usability & instructions",
  feature_request: "Feature requests",
  email_delivery: "Email delivery",
  other: "Other",
};

export function categoryLabel(category: SupportInsightCategory): string {
  return CATEGORY_LABELS[category];
}

export function improvementPriority(input: { issues: number; open: number }): number {
  return input.issues * 3 + input.open;
}

export interface SupportInsightThemeSummary {
  category: SupportInsightCategory;
  label: string;
  issues: number;
  occurrences: number;
  open: number;
}

export function summarizeInsightRows(rows: readonly SupportInsightRow[]): {
  totalIssues: number;
  openIssues: number;
  sources: Record<SupportInsightSource, number>;
  themes: SupportInsightThemeSummary[];
} {
  const sources: Record<SupportInsightSource, number> = { dashboard: 0, gmail: 0, both: 0 };
  const themes = new Map<SupportInsightCategory, Omit<SupportInsightThemeSummary, "label">>();
  let openIssues = 0;

  for (const row of rows) {
    sources[row.source] += 1;
    const isOpen = row.status === "open" || row.status === "in_progress";
    if (isOpen) openIssues += 1;
    const current = themes.get(row.category) ?? {
      category: row.category,
      issues: 0,
      occurrences: 0,
      open: 0,
    };
    current.issues += 1;
    current.occurrences += row.occurrence_count;
    if (isOpen) current.open += 1;
    themes.set(row.category, current);
  }

  return {
    totalIssues: rows.length,
    openIssues,
    sources,
    themes: [...themes.values()]
      .map((theme) => ({ ...theme, label: categoryLabel(theme.category) }))
      .sort((a, b) =>
        improvementPriority(b) - improvementPriority(a)
        || b.issues - a.issues
        || a.label.localeCompare(b.label)),
  };
}
