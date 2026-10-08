import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { suggestSupportReply, validateSupportReply, SUPPORT_REPLY_MAX } from "./support-replies";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migration-support-replies.sql");
const fn = read("supabase/functions/reply-support-request/index.ts");
const admin = read("app/admin/page.tsx");
const help = read("components/FeedbackButton.tsx");

test("reply text is trimmed and length-checked", () => {
  assert.deepEqual(validateSupportReply("  Thanks, fixed!  "), { ok: true, text: "Thanks, fixed!" });
  assert.equal(validateSupportReply("   ").ok, false);
  assert.equal(validateSupportReply("x".repeat(SUPPORT_REPLY_MAX + 1)).ok, false);
  assert.equal(validateSupportReply("x".repeat(SUPPORT_REPLY_MAX)).ok, true);
});

test("new support requests receive a personalized editable draft", () => {
  const draft = suggestSupportReply({
    fullName: "Amaka Uzoalu",
    category: "help",
    feedback: "I joined the wrong team and need to switch.",
  });
  assert.match(draft, /^Hi Amaka,/);
  assert.match(draft, /reviewing your team membership request/i);
  assert.match(draft, /FCL Wellness Challenge App Team/);
  assert.doesNotMatch(draft, /has been (changed|completed|resolved)/i);
});

test("suggested drafts adapt safely to the ticket category", () => {
  assert.match(suggestSupportReply({ fullName: "Pat Doe", category: "problem", feedback: "The page is stuck." }), /looking into the issue/i);
  assert.match(suggestSupportReply({ fullName: "Pat Doe", category: "idea", feedback: "Add a chart." }), /Thank you for the suggestion/i);
  assert.match(suggestSupportReply({ fullName: "Pat Doe", category: "feedback", feedback: "Great challenge." }), /sharing your feedback/i);
});

test("replies are stored privately and only written by the server", () => {
  assert.match(migration, /create table if not exists public\.support_replies/);
  assert.match(migration, /references public\.survey_responses\(id\) on delete cascade/);
  assert.match(migration, /check \(char_length\(btrim\(body\)\) between 1 and 2000\)/);
  assert.match(migration, /alter table public\.support_replies enable row level security/);
  assert.match(migration, /create policy "support_replies_read_own_or_admin"/);
  assert.match(migration, /r\.user_id = auth\.uid\(\)/);
  assert.match(migration, /public\.is_current_user_admin\(\)/);
  assert.doesNotMatch(migration, /public\.current_user_is_admin\(\)/);
  assert.match(migration, /revoke all on table public\.support_replies from public, anon, authenticated/);
  assert.match(migration, /grant select on table public\.support_replies to authenticated/);
  assert.match(migration, /has_table_privilege\('authenticated', 'public\.support_replies', 'INSERT'\)/);
});

test("reply function is admin-only, escapes text, emails once, and never leaks addresses", () => {
  assert.match(fn, /adminProfile\?\.is_admin !== true/);
  assert.match(fn, /Administrator access required/);
  assert.match(fn, /function escapeHtml/);
  assert.match(fn, /escapeHtml\(reply\)/);
  assert.match(fn, /"Idempotency-Key": `support-reply-\$\{replyRow\.id\}`/);
  assert.match(fn, /from\("support_replies"\)\s*\.insert/);
  assert.match(fn, /\.delete\(\)\s*\.eq\("id", replyRow\.id\)/);
  assert.match(fn, /markResolved/);
  assert.match(fn, /resolution_email_sent_at: sentAt/);
  assert.match(fn, /in partnership with FCL/);
  assert.doesNotMatch(fn, /response\(\{[^}]*participantEmail/);
});

test("admin inbox has an accessible reply box with send and send-and-resolve", () => {
  assert.match(admin, /reply-support-request/);
  assert.match(admin, /<label htmlFor=\{`reply-\$\{message\.id\}`\}/);
  assert.match(admin, /<textarea[\s\S]*id=\{`reply-\$\{message\.id\}`\}/);
  assert.match(admin, /text-slate-900/);
  assert.match(admin, /Send reply/);
  assert.match(admin, /Send reply &amp; resolve/);
  assert.match(admin, /from\("support_replies"\)/);
  assert.match(admin, /Reply emailed/);
  assert.match(admin, /suggestSupportReply/);
  assert.match(admin, /Suggested draft — review and edit before sending/);
  assert.match(admin, /Nothing is sent until you select a send button/);
});

test("participants see app-team replies under My support requests", () => {
  assert.match(help, /from\("support_replies"\)/);
  assert.match(help, /App team reply/);
  assert.match(help, /To follow up, send a new message below/);
});
