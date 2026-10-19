# FCL 2026 logging close

## Approved deadline and copy

- Logging closes at **00:00 October 31, 2026, America/Regina (UTC−06:00)**: the start of October 31, immediately after October 30 ends. UTC equivalent: **2026-10-31T06:00:00Z**.
- October 30 at noon and the rest of that day remain open under the existing activity-date/check-in rules. October 31 is not an activity date.
- Closed message (including the approved initial capital and final period):

  > The FCL Challenge is officially over. Thank you for participating in the challenge! You are awesome 🙌.

## What changed

The client replaces logging forms with the message, updates already-open tabs at the deadline and on focus/visibility, rechecks each submission, removes check-in nudges, and makes entry history read-only. The recap heading uses the same message; the recap button now appears only when logging has actually closed.

An additive database statement trigger blocks **INSERT, UPDATE and DELETE on both `activity_entries` and `wellness_checkins`**, including backdated activity, check-in comment edits/deletes, stale clients and writes through RPCs. It uses `clock_timestamp()` rather than the transaction-start clock. Existing scoring, record contents, participation dates, RLS, audit rules and prize/draw eligibility definitions are untouched. No new scheduled job is needed.

The guard applies to administrators/service-role callers too; after closure an activity-audit reduction cannot silently change a final score. Existing reads, support, standings and draw operations remain available. A separately approved correction after closure would require an explicit, reviewed database change rather than an undocumented bypass.

## Production handoff — not yet applied by this change

1. Confirm Supabase project **nqxafecitlvvqhfknjnm**, serving **https://fclwellnesschallengeapp.ca**.
2. In a fresh dashboard SQL query, apply **only `supabase/migration-challenge-logging-close.sql`**. This is schema-only: it does not insert, update or delete participant records. Its boundary assertions run inside the migration transaction.
3. Run **`supabase/tests/logging-close-rollback-test.sql`** as the SQL editor owner. It verifies actual guard bindings and privilege restrictions, checks noon and microsecond boundaries, and exercises the real trigger on a **temporary probe table**. It temporarily replaces only the new helper inside a transaction to simulate the boundary; `ROLLBACK` restores it. No participant table DML occurs. Require the final `restored_cutoff_pass` result to be **true**. If execution stops on an error, explicitly run `ROLLBACK;` before any other query.
4. Independently read back the installed guards and helper (no participant data):

   ```sql
   select tgname, tgrelid::regclass, tgenabled,
          pg_get_triggerdef(oid) as definition
   from pg_trigger
   where tgname in ('enforce_challenge_logging_close_activity',
                    'enforce_challenge_logging_close_checkins');

   select pg_get_functiondef('public.challenge_logging_is_closed(timestamptz)'::regprocedure),
          pg_get_functiondef('public.enforce_challenge_logging_close()'::regprocedure);
   ```

   Require two enabled (`O`) BEFORE STATEMENT INSERT/UPDATE/DELETE triggers and the exact approved timestamp; require the guard to call the helper, with no role bypass.
5. After the DB step, deploy the tested main commit with **`npx vercel --prod --yes`** and record its deployment URL. Check signed-in production logging still works visually before the deadline **without submitting records**, and verify deployment asset/version identity. Production post-cutoff write rejection cannot be honestly claimed before the cutoff without a controlled simulation; use the rollback-only probe above, not participant writes.

Do not re-run the entire schema against production. `supabase/schema.sql` includes the same guard for fresh installations only.

## Local verification

```sh
npm test
npx eslint lib/constants.ts lib/errors.ts lib/logging-close.ts lib/logging-close.test.ts lib/logging-close-clock.test.ts lib/useLoggingClosed.ts components/ChallengeClosed.tsx components/ActivityForm.tsx components/WellnessCheckin.tsx components/EntryLog.tsx components/Dashboard.tsx app/wrap-up/page.tsx scripts/test-logging-close-sql.mjs
npm run build
```

To exercise real PostgreSQL syntax and triggers locally without Supabase credentials or participant records, install PGlite **only in a scratch directory**, then point the committed runner there:

```sh
npm install --prefix "$TMPDIR/fcl-close-sql" --no-audit --no-fund --package-lock=false @electric-sql/pglite
PGLITE_TEST_ROOT="$TMPDIR/fcl-close-sql" node scripts/test-logging-close-sql.mjs
```

The runner uses in-memory table skeletons and no `.env` or network database connection. It applies the migration twice to verify idempotency, executes the committed rollback test as well as read-back checks, and asserts that both participant-table skeletons stay empty. PGlite validates PostgreSQL behavior; it does not establish which migrations are installed in hosted production.

## Previous state and communication contradictions

Repository code already used an inclusive October 30 end date and a Regina-calendar October 31 recap gate. There was **no global write deadline**: activity inserts/edits/deletes and existing check-in edits/deletes could continue after the end date; check-in inserts were date-gated by the scoring normalizer. The new guard closes those actual database paths, not just the UI.

`public/email-sequence-2026.txt` still contains the older **October 30 noon / 12:00 PM** deadline (intro and Emails #6/#7). `lib/end-of-challenge-report.mjs` has an older noon comment, but its actual report date bounds remain October 5–30 and do not need changing. These artifacts are flagged for the parent/operator; they were intentionally not edited in this implementation. Live Gmail drafts were not read, changed or sent. Any corresponding live drafts need review separately. Draw definitions, draw jobs, email jobs and cron entries were not changed; the new logging deadline is not authority to reschedule a draw.
