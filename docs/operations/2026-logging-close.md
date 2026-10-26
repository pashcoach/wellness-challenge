# FCL 2026 logging close

## Official deadline and communication decision

- Logging closes **Friday, October 30, 2026 at 12:00 PM (NOON), Saskatchewan time (America/Regina, UTC−06:00)**. Exact UTC cutoff: **2026-10-30T18:00:00Z**.
- Immediately before noon, existing activity-date and check-in rules still apply. **At noon, submissions and activity/check-in edits/deletes are closed.** This replaces the previously installed October 31 midnight cutoff; it does not change activity dates, existing entries, scoring or prize eligibility definitions.
- Committee approved **Thursday reminder email + prominent participant app notice only**. **No separate correction email.** Parent/operator owns email review; this code change does not edit Gmail, email schedules or cron.
- Exact post-close message is unchanged:

  > The FCL Challenge is officially over. Thank you for participating in the challenge! You are awesome 🙌.

## App behavior and scope

The persistent, non-dismissible notice sits immediately below the participant dashboard header, above week controls. It explicitly asks participants to log all activities and complete the final wellness check-in before noon Friday, names Saskatchewan/Regina time, and distinguishes noon from midnight. It uses a labelled heading/section, wrapping text and explicit high-contrast light/dark colors; no keyboard interaction is required. It disappears when the existing live logging clock closes.

The shared deadline closes activity/check-in forms and submission handlers, makes entry history read-only, suppresses logging nudges and updates resumed tabs on focus/visibility. Existing records remain readable. The separately scheduled October 31 recap availability gate remains unchanged.

The existing database statement guards block INSERT/UPDATE/DELETE on `activity_entries` and `wellness_checkins`, including zero-row statements and stale/backdated writes. They still use the wall clock (`clock_timestamp()`), not transaction-start time. This revision replaces **only the installed date helper**, preserving function identity/ACL and both trigger bindings. There is no new admin/service-role bypass. Existing admin reads, support, standings and prize/draw paths are untouched; post-close score-changing activity edits remain blocked as before. No draw is run or rescheduled.

## Production handoff — parent/operator applies DB first

1. Confirm Supabase project **nqxafecitlvvqhfknjnm**, serving **https://fclwellnesschallengeapp.ca**. The original guard migration is already installed; do not rerun it as the deadline update.
2. In a fresh SQL editor query apply **only `supabase/migration-challenge-logging-noon-deadline.sql`**. It checks both installed guards, replaces the helper and asserts the noon boundary within one transaction. It is schema-only and safe to rerun; no participant records are inserted, updated or deleted. If guard prerequisites fail, stop and inspect rather than removing the check.
3. Run **`supabase/tests/logging-close-rollback-test.sql`** as the SQL editor owner. It validates installed cutoff boundaries, actual guard bindings and privilege restrictions, then exercises the real trigger on a **temporary probe table only**. Temporary helper overrides simulate one microsecond before and exactly at noon; `ROLLBACK` restores the official helper. Require final **`restored_cutoff_pass = true`**. If execution stops on error, explicitly issue `ROLLBACK;` before any other query. Run the entire file, not individual override statements.
4. Independently read back the exact installed targets (no participant data):

   ```sql
   select tgname, tgrelid::regclass, tgenabled,
          pg_get_triggerdef(oid) as definition
   from pg_trigger
   where tgname in ('enforce_challenge_logging_close_activity',
                    'enforce_challenge_logging_close_checkins');

   select pg_get_functiondef('public.challenge_logging_is_closed(timestamptz)'::regprocedure),
          pg_get_functiondef('public.enforce_challenge_logging_close()'::regprocedure);

   select not public.challenge_logging_is_closed('2026-10-30T17:59:59.999999Z') as before_noon_open,
          public.challenge_logging_is_closed('2026-10-30T18:00:00Z') as at_noon_closed;
   ```

   Require both booleans true, two enabled (`O`) BEFORE STATEMENT INSERT/UPDATE/DELETE guards, the helper's exact `2026-10-30T12:00:00-06:00` cutoff and a guard calling it without a role bypass.
5. **Only after DB verification**, parent/operator may deploy the tested commit using `npx vercel --prod --yes`; record deployment URL and asset/version identity. Visually confirm the participant notice and pre-close controls without submitting records. A Git push is not a production deployment. This implementation performs no manual deployment.

Do not run the entire schema against production. Fresh installations use `supabase/schema.sql`, which retains the historical guard installation followed by the noon helper revision. Never run the old migration alone after the noon revision: it reinstates the superseded midnight cutoff.

## Local verification

```sh
npm test
npx eslint lib/constants.ts lib/logging-close.ts lib/logging-close.test.ts lib/logging-close-clock.test.ts components/LoggingDeadlineNotice.tsx components/Dashboard.tsx scripts/test-logging-close-sql.mjs
npm run build
```

Isolated PostgreSQL tests, no Supabase credentials/network connection and no real participant records:

```sh
SQL_TEST_ROOT=/Users/pash/.hermes/profiles/coding/cache/scratch/fcl-close-sql
npm install --prefix "$SQL_TEST_ROOT" --no-audit --no-fund --package-lock=false @electric-sql/pglite
PGLITE_TEST_ROOT="$SQL_TEST_ROOT" node scripts/test-logging-close-sql.mjs
```

The runner installs the historical guard locally, applies the noon revision twice, checks helper identity/ACL and trigger identities/bindings remain unchanged, executes authenticated open/closed writes on the rollback-only probe and verifies noon and microsecond boundaries. Synthetic pre-existing rows in both local table skeletons are checked unchanged. PGlite tests real PostgreSQL behavior; they do not establish hosted production state. Production verification belongs to the parent/operator.

Revision verification: 171 Node tests passed, scoped ESLint passed, production build (including TypeScript) passed, and isolated PostgreSQL tests passed. The actual notice rendered with compiled production CSS was checked at 320px and 1280px in light and dark browser modes: no horizontal overflow; text contrast approximately 14.47:1 light / 16.00:1 dark. This was a standalone component render, not an authenticated production-dashboard test.

## Communication consistency

The existing repository email sequence already states October 30 noon / 12:00 PM. The committee's official deadline now matches it. Keep the Thursday reminder aligned with the app notice; no correction email is authorized. Live Gmail drafts, scheduled jobs, draws and production participant data were not accessed or modified by this change.
