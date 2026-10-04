import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const feedbackSource = readFileSync("components/FeedbackButton.tsx", "utf8");
const adminSource = readFileSync("app/admin/page.tsx", "utf8");
const migrationSource = readFileSync("supabase/migration-support-inbox.sql", "utf8");
const schemaSource = readFileSync("supabase/schema.sql", "utf8");
const resolutionMigrationPath = "supabase/migration-support-resolution-notifications.sql";
const resolutionFunctionPath = "supabase/functions/resolve-support-request/index.ts";
const resolutionMigrationSource = existsSync(resolutionMigrationPath) ? readFileSync(resolutionMigrationPath, "utf8") : "";
const resolutionFunctionSource = existsSync(resolutionFunctionPath) ? readFileSync(resolutionFunctionPath, "utf8") : "";

test("participant support opens as Need help with guided FAQs and categorized contact options", () => {
  assert.match(feedbackSource, /Need help\?/);
  assert.match(feedbackSource, /Quick answers/);
  assert.match(feedbackSource, /How are points calculated\?/);
  assert.match(feedbackSource, /How do I leave, switch, or delete a team\?/);
  assert.match(feedbackSource, /before your first entry in the app/i);
  assert.match(feedbackSource, /checking “I supported my .* this week” and selecting “Confirm check-in/i);
  assert.match(feedbackSource, /ownership transfers/i);
  assert.match(feedbackSource, /choose Join a team.*pick a team from the list/i);
  assert.match(feedbackSource, /No invite code is needed/);
  assert.doesNotMatch(feedbackSource, /Join with a team code/);
  assert.match(feedbackSource, /Report a problem/);
  assert.match(feedbackSource, /Share an idea/);
  assert.match(feedbackSource, /category/);
});

test("participants can review only their own support requests and current statuses", () => {
  assert.match(feedbackSource, /My support requests/);
  assert.match(feedbackSource, /\.eq\("user_id", profile\.id\)/);
  assert.match(feedbackSource, /New/);
  assert.match(feedbackSource, /In progress/);
  assert.match(feedbackSource, /Resolved/);
  assert.match(feedbackSource, /updated_at/);
});

test("admin dashboard includes a support inbox with message status controls", () => {
  assert.match(adminSource, /Support inbox/);
  assert.match(adminSource, /feedback, category, status, created_at/);
  assert.match(adminSource, /In progress/);
  assert.match(adminSource, /Resolved/);
  assert.match(adminSource, /survey_responses/);
});

test("resolving a request uses the authenticated notification function", () => {
  assert.match(adminSource, /resolve-support-request/);
  assert.match(resolutionFunctionSource, /notifications@fclwellnesschallengeapp\.ca/);
  assert.match(resolutionFunctionSource, /RESEND_API_KEY/);
  assert.match(resolutionFunctionSource, /auth\.admin\.getUserById/);
  assert.match(resolutionFunctionSource, /is_admin/);
  assert.match(resolutionFunctionSource, /Idempotency-Key/);
  assert.match(resolutionMigrationSource, /resolution_email_sent_at/i);
  assert.match(schemaSource, /resolution_email_sent_at timestamptz/i);
});

test("support storage permits multiple requests and limits triage updates to administrators", () => {
  assert.match(migrationSource, /drop constraint if exists survey_responses_user_id_key/i);
  assert.match(migrationSource, /category/i);
  assert.match(migrationSource, /status/i);
  assert.match(migrationSource, /is_admin/i);
  assert.match(migrationSource, /grant update \(status, updated_at\)/i);
  assert.doesNotMatch(schemaSource, /user_id uuid unique references auth\.users/i);
  assert.match(schemaSource, /category text not null default 'feedback'/i);
  assert.match(schemaSource, /status text not null default 'new'/i);
});
