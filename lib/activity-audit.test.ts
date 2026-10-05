import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ACTIVITY_LOGGING_HINT,
  ACTIVITY_TIME_FAQ,
  DAILY_ACTIVITY_REVIEW_MINUTES,
  LONG_ENTRY_FLAG_MINUTES,
  auditReasons,
  auditRequestEmail,
  validateAdjustedMinutes,
} from "./activity-audit";

const feedbackSource = readFileSync("components/FeedbackButton.tsx", "utf8");
const activityFormSource = readFileSync("components/ActivityForm.tsx", "utf8");
const entryLogSource = readFileSync("components/EntryLog.tsx", "utf8");
const errorsSource = readFileSync("lib/errors.ts", "utf8");

test("activity-time guidance allows batch entry but requires the actual activity date", () => {
  assert.equal(DAILY_ACTIVITY_REVIEW_MINUTES, 240);
  assert.equal(LONG_ENTRY_FLAG_MINUTES, 180);
  assert.match(ACTIVITY_LOGGING_HINT, /intentional/i);
  assert.match(ACTIVITY_LOGGING_HINT, /work shift/i);
  assert.match(ACTIVITY_LOGGING_HINT, /several days at once/i);
  assert.match(ACTIVITY_LOGGING_HINT, /date it happened/i);
  assert.doesNotMatch(ACTIVITY_LOGGING_HINT, /daily limit/i);
  assert.equal(ACTIVITY_TIME_FAQ.question, "What counts as activity time?");
  assert.match(ACTIVITY_TIME_FAQ.answer, /workout/i);
  assert.match(ACTIVITY_TIME_FAQ.answer, /all-day step/i);
  assert.match(ACTIVITY_TIME_FAQ.answer, /week.*single sitting/i);
  assert.match(ACTIVITY_TIME_FAQ.answer, /actual date/i);
  assert.doesNotMatch(ACTIVITY_TIME_FAQ.answer, /240 minutes \(4 hours\) per day/);
  assert.match(ACTIVITY_TIME_FAQ.answer, /contact you privately/i);
});

test("the FAQ and activity form show guidance without an input cap", () => {
  assert.match(feedbackSource, /ACTIVITY_TIME_FAQ/);
  assert.match(activityFormSource, /ACTIVITY_LOGGING_HINT/);
  assert.doesNotMatch(activityFormSource, /max=\{DAILY_ACTIVITY_LIMIT_MINUTES\}/);
  assert.doesNotMatch(entryLogSource, /max=\{DAILY_ACTIVITY_LIMIT_MINUTES\}/);
  assert.doesNotMatch(errorsSource, /Daily activity limit/);
});

test("audit reasons flag a high daily total and a long single entry", () => {
  assert.deepEqual(auditReasons({ dayMinutes: 120, maxEntryMinutes: 60 }), []);
  assert.deepEqual(auditReasons({ dayMinutes: 240, maxEntryMinutes: 180 }), []);
  assert.deepEqual(auditReasons({ dayMinutes: 241, maxEntryMinutes: 60 }), [
    "More than 240 minutes in one day",
  ]);
  assert.deepEqual(auditReasons({ dayMinutes: 630, maxEntryMinutes: 600 }), [
    "More than 240 minutes in one day",
    "Single entry over 180 minutes",
  ]);
});

test("administrators may only reduce an entry", () => {
  assert.equal(validateAdjustedMinutes(600, 120), null);
  assert.equal(validateAdjustedMinutes(600, 600), "Enter fewer minutes than the current entry.");
  assert.equal(validateAdjustedMinutes(600, 700), "Enter fewer minutes than the current entry.");
  assert.equal(validateAdjustedMinutes(600, 0), "Enter a whole number of minutes, 1 or more.");
  assert.equal(validateAdjustedMinutes(600, 2.5), "Enter a whole number of minutes, 1 or more.");
});

test("the participant request is friendly, private, and does not accuse", () => {
  const email = auditRequestEmail({ firstName: "Sam", entryDate: "2026-10-05", dayMinutes: 630 });
  assert.equal(email.subject, "FCL Wellness Challenge: quick check on your October 5 activity");
  assert.match(email.body, /^Hi Sam,/);
  assert.match(email.body, /630 minutes/);
  assert.doesNotMatch(email.body, /daily limit|240 minutes|within 3 days/i);
  assert.match(email.body, /reply/i);
  assert.match(email.body, /Endurance Journey/);
  assert.match(email.body, /How to edit or delete an entry:/);
  assert.match(email.body, /My entry log/);
  assert.match(email.body, /pencil icon \(✏️\).*"Save changes"/);
  assert.match(email.body, /trash icon \(🗑️\).*"Delete"/);
  assert.match(email.body, /https:\/\/fclwellnesschallengeapp\.ca/);
  assert.match(email.body, /FCL/);
  assert.doesNotMatch(email.body, /cheat|fraud|suspicious/i);
});

const migrationSource = readFileSync("supabase/migration-activity-audit.sql", "utf8");
const removeLimitMigrationSource = readFileSync("supabase/migration-remove-daily-activity-limit.sql", "utf8");
const schemaSource = readFileSync("supabase/schema.sql", "utf8");
const adminSource = readFileSync("app/admin/page.tsx", "utf8");
const auditQueueSource = readFileSync("components/ActivityAuditQueue.tsx", "utf8");

test("the daily limit is removed while audit review remains", () => {
  assert.match(removeLimitMigrationSource, /drop trigger if exists enforce_daily_activity_limit on public\.activity_entries/);
  assert.match(removeLimitMigrationSource, /drop function if exists public\.enforce_daily_activity_limit\(\)/);
  assert.doesNotMatch(schemaSource, /create trigger enforce_daily_activity_limit/);
  assert.doesNotMatch(schemaSource, /Daily activity limit reached/);
  assert.match(schemaSource, /where d\.day_minutes > 240 or d\.max_entry_minutes > 180/);
});

test("audit reviews are private and changed only through admin RPCs", () => {
  for (const source of [migrationSource, schemaSource]) {
    assert.match(source, /create table if not exists public\.activity_audit_reviews/);
    assert.match(source, /alter table public\.activity_audit_reviews enable row level security;/);
    assert.match(source, /revoke all on public\.activity_audit_reviews from public, anon, authenticated;/);
    for (const fn of ["admin_activity_audit_queue()", "admin_mark_activity_day_reviewed(uuid, date, text)", "admin_reduce_activity_entry(uuid, integer, text)"]) {
      assert.ok(source.includes(`revoke all on function public.${fn} from public, anon, authenticated;`), fn);
      assert.ok(source.includes(`grant execute on function public.${fn} to authenticated;`), fn);
    }
    assert.match(source, /if not public\.is_current_user_admin\(\) then/);
    assert.match(source, /p_minutes >= v_entry\.minutes/);
  }
});

test("the admin dashboard shows the audit queue with approve, reduce, and email actions", () => {
  assert.match(adminSource, /<ActivityAuditQueue \/>/);
  assert.match(auditQueueSource, /Activity audit queue/);
  assert.match(auditQueueSource, /rpc\("admin_activity_audit_queue"\)/);
  assert.match(auditQueueSource, /rpc\("admin_mark_activity_day_reviewed"/);
  assert.match(auditQueueSource, /rpc\("admin_reduce_activity_entry"/);
  assert.match(auditQueueSource, /validateAdjustedMinutes/);
  assert.match(auditQueueSource, /auditRequestEmail/);
  assert.match(auditQueueSource, /mailto:/);
  assert.match(auditQueueSource, /window\.confirm/);
});
