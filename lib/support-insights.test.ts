import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  categoryLabel,
  improvementPriority,
  summarizeInsightRows,
  type SupportInsightRow,
} from "./support-insights";

const adminSource = readFileSync("app/admin/page.tsx", "utf8");
const migrationSource = readFileSync("supabase/migration-support-insights.sql", "utf8");

const rows: SupportInsightRow[] = [
  {
    issue_key: "dashboard:a",
    source: "both",
    category: "account_access",
    topic: "password_reset",
    first_seen: "2026-10-05T10:00:00Z",
    last_seen: "2026-10-06T10:00:00Z",
    status: "resolved",
    response_sent: true,
    response_channel: "gmail",
    occurrence_count: 2,
  },
  {
    issue_key: "gmail:b",
    source: "gmail",
    category: "account_access",
    topic: "password_reset",
    first_seen: "2026-10-07T10:00:00Z",
    last_seen: "2026-10-07T10:00:00Z",
    status: "responded",
    response_sent: true,
    response_channel: "gmail",
    occurrence_count: 1,
  },
  {
    issue_key: "dashboard:c",
    source: "dashboard",
    category: "team_membership",
    topic: "team_join",
    first_seen: "2026-10-08T10:00:00Z",
    last_seen: "2026-10-08T10:00:00Z",
    status: "open",
    response_sent: false,
    response_channel: "none",
    occurrence_count: 1,
  },
];

test("summarizes deduplicated issues by theme and source", () => {
  const summary = summarizeInsightRows(rows);
  assert.equal(summary.totalIssues, 3);
  assert.equal(summary.openIssues, 1);
  assert.deepEqual(summary.sources, { dashboard: 1, gmail: 1, both: 1 });
  assert.deepEqual(summary.themes[0], {
    category: "account_access",
    label: "Account access",
    issues: 2,
    occurrences: 3,
    open: 0,
  });
});

test("priority ranks recurring open issues above isolated resolved issues", () => {
  assert.ok(improvementPriority({ issues: 3, open: 2 }) > improvementPriority({ issues: 1, open: 0 }));
  assert.equal(categoryLabel("activity_points"), "Activities & points");
});

test("admin loads the private RPC and does not query the insight table directly", () => {
  assert.match(adminSource, /support_improvement_report/);
  assert.doesNotMatch(adminSource, /from\(["']support_insight_events["']\)/);
  assert.match(adminSource, /Private improvement report/);
});

test("migration keeps source data private and returns no participant identifiers", () => {
  assert.match(migrationSource, /create schema if not exists private/i);
  assert.match(migrationSource, /revoke all on table private\.support_insight_events from public, anon, authenticated/i);
  assert.match(migrationSource, /public\.support_improvement_report/i);
  const reportSignature = migrationSource.match(
    /create or replace function public\.support_improvement_report[\s\S]*?as \$\$/i,
  )?.[0] ?? "";
  assert.doesNotMatch(reportSignature, /participant_id/i);
  assert.doesNotMatch(reportSignature, /sender_email/i);
});
