# Fitness Device Integrations Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Safely import eligible workout summaries from participant fitness services without exposing credentials, duplicating points, or jeopardizing the October 5, 2026 launch.

**Architecture:** Keep manual entry as the supported 2026 path. First move activity scoring and protected-account changes behind server-owned database operations. After provider approval and a participant survey, build one reusable cloud-connector framework and pilot exactly one cloud provider (Garmin Connect or Google Health API). Apple HealthKit and Android Health Connect are separate future native-app projects, not web OAuth buttons.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Auth/Postgres/RLS/Edge Functions or Vercel server routes, provider OAuth 2.0 with PKCE/state, scheduled sync/webhooks.

---

## Executive decision

### Recommendation for the October 5–30, 2026 challenge

Do **not** attempt smartwatch auto-sync before launch. Preserve manual entry for this challenge and make the current app safer before launch.

Reasons:

- Launch is 10 days away.
- Garmin says production access requires approval and a typical integration takes 1–4 weeks after approval.
- Google Health API is a viable web/cloud direction for Fitbit and Pixel Watch data, but production OAuth verification and restricted health-data requirements must be resolved first.
- Apple HealthKit and Android Health Connect require native companion apps and device-local permission flows; the website alone cannot read them.
- Strava's June 1, 2026 API Agreement says data from one user can only be displayed/disclosed to that user, which conflicts with using imported Strava data to calculate shared workplace leaderboards unless Strava explicitly approves the use.
- The current browser writes `points`, `week`, and profile fields directly to Supabase. Existing RLS lets users update their own activity rows and their entire profile row, including security-sensitive values. Imported data should not be added until scoring and authorization are server-controlled.

### Scope adjustment to GitHub issue #1

The issue's provider analysis and security direction are sound. One recommendation should be reduced for this fixed annual app: do **not** build a full multi-tenant organizations/challenges platform before the 2026 challenge. That redesign is not required to pilot one connector and would add launch risk. Add a minimal challenge identifier and versioned scoring rule only when the connector pilot begins; consider multi-tenancy only if this becomes a reusable product for multiple organizations.

---

## Phase 0: Product and compliance decisions (no connector code)

### Task 1: Survey participant device sources

**Objective:** Choose the first provider from actual participant demand.

**Files:**
- Modify: `components/OnboardingForm.tsx` or create a separate post-registration survey component
- Create: `supabase/migration-fitness-provider-survey.sql`
- Test: component validation test if the survey is implemented in-app

**Steps:**

1. Ask which source participants use: Garmin, Fitbit/Pixel Watch, Apple Health, Android Health Connect/Samsung Health, Strava, none, or other.
2. Make the answer optional and state that it is for planning only, not an integration promise.
3. Store only the selected service, not health data.
4. Report counts in `app/admin/page.tsx`.
5. Run `npm test`, `npm run lint`, and `npm run build`.

**Decision gate:**
- Garmin leads: submit Garmin Connect Developer Program application immediately.
- Fitbit/Pixel Watch leads: begin Google Health API access and OAuth verification work.
- Apple/Android local stores dominate: estimate native companion apps rather than pretending the web app can connect directly.
- No clear leader: keep manual entry and reassess after the challenge.

### Task 2: Approve privacy and scoring policy

**Objective:** Get written business approval before collecting health-derived data.

Document and approve:

- Imported fields: provider activity ID, type, start/end timestamps, time zone, and duration only.
- Explicitly excluded fields: GPS routes, heart rate, sleep, weight, medical metrics, and raw FIT/GPX files unless a later use case requires them.
- Leaderboards expose points and existing privacy-safe display names, not detailed workouts.
- Participants can disconnect and request deletion of imported source data.
- Manual entry remains available.
- Imported points use the same rule as manual points: one point per eligible minute (equivalent to 10 points per 10 minutes).
- Define whether active duration or elapsed duration controls scoring; recommended default is provider-reported active/moving duration when available.
- Define final-sync deadline after October 30 and retention/deletion timing.

**Acceptance criterion:** A named FCL privacy/security owner approves the policy and provider terms before production credentials are requested.

---

## Phase 1: Pre-launch security foundation

### Task 3: Make activity scoring server-owned

**Objective:** Prevent browsers from choosing their own points, week, user, or out-of-range dates.

**Files:**
- Create: `supabase/migration-server-owned-scoring.sql`
- Modify: `components/ActivityForm.tsx`
- Modify: `components/EntryLog.tsx`
- Modify: `lib/constants.ts`
- Create: `lib/activity-scoring.ts`
- Create: `lib/activity-scoring.test.ts`

**Steps:**

1. Write tests for challenge date validation, Saskatchewan time boundaries, week calculation, positive whole-minute validation, and point calculation.
2. Run the test and confirm it fails before implementation.
3. Add a Postgres RPC such as `log_activity(activity_name, minutes, entry_date)` that derives `auth.uid()`, validates the challenge window, calculates week and points, and inserts the row atomically.
4. Add an `update_activity` RPC with the same validation and ownership checks.
5. Revoke or block direct client insert/update of scoring-owned columns after the RPC is working.
6. Change `ActivityForm.tsx` and `EntryLog.tsx` to call the RPCs rather than writing points/week/user directly.
7. Confirm users can still delete their own manual entries if that remains the approved behavior.
8. Run `npm test`, `npm run lint`, and `npm run build`.
9. Test with two Supabase users: each can change only their own entries and cannot submit arbitrary points.

### Task 4: Protect admin and identity fields

**Objective:** Ensure a participant cannot make themselves an admin or alter protected profile ownership fields through the Supabase client.

**Files:**
- Create or extend: `supabase/migration-server-owned-scoring.sql`
- Modify only if needed: `components/OnboardingForm.tsx`
- Test: SQL authorization checks documented alongside the migration

**Steps:**

1. Add a trigger or column-level privilege design that rejects participant changes to `profiles.id`, `profiles.is_admin`, and any future provider/security fields.
2. Restrict ordinary profile updates to approved participant-editable fields only.
3. Audit every `SECURITY DEFINER` function: set a fixed `search_path`, validate `auth.uid()`, and grant execute only to required roles.
4. Verify a participant cannot promote themselves, edit another profile, or change server-owned score values.
5. Verify admin workflows still function.

**Release gate:** Do not start storing OAuth tokens until Tasks 3–4 pass their authorization tests.

---

## Phase 2: Reusable cloud connector framework

### Task 5: Add minimal connector data model

**Objective:** Store connection state, imported source activities, and replay-safe credits without exposing tokens.

**Files:**
- Create: `supabase/migration-fitness-connectors.sql`
- Modify: `lib/data.ts`

**Tables/fields:**

- `fitness_connections`: user ID, provider, provider account pseudonymous ID, granted scopes, status, cursor, last successful sync, last error category, token-secret reference, created/updated timestamps.
- `imported_activities`: connection ID, provider activity ID, source app/device if available, original type, normalized type, start/end timestamps, source time zone, active/elapsed minutes, status, payload hash, created/updated timestamps.
- `activity_credits`: imported activity ID, challenge key (`fcl-2026`), scoring-rule version, credited activity-entry ID, created timestamp.
- Unique constraints on `(provider, provider_activity_id, connection_id)` and `(imported_activity_id, challenge_key)`.

**Security:**

- Participants may read only their own connection status and imported summaries.
- Provider tokens never appear in browser-readable tables, client bundles, logs, or error messages.
- Leaderboard queries use credited points only, not raw imported health data.
- Service-role/server processes perform import writes.

### Task 6: Create provider-neutral normalization and scoring

**Objective:** Convert provider records into stable challenge categories and exactly-once credits.

**Files:**
- Create: `lib/fitness/types.ts`
- Create: `lib/fitness/normalize.ts`
- Create: `lib/fitness/normalize.test.ts`
- Create: `lib/fitness/score-import.ts`
- Create: `lib/fitness/score-import.test.ts`

**Required mappings:** running, cycling, swimming, walking, hiking, strength, yoga, and unmapped.

**Tests:**

- Known provider types map correctly.
- Unknown/generic workouts remain uncredited until participant review.
- Retries do not duplicate points.
- Provider updates recalculate one credit safely.
- Provider deletions reverse or invalidate the associated credit according to policy.
- Activities outside October 5–30 receive no credit.
- Overlapping records from different providers are flagged, not silently merged.
- Saskatchewan challenge-day boundaries are deterministic.

### Task 7: Add secure OAuth lifecycle routes

**Objective:** Implement reusable connect, callback, status, sync, and disconnect flows.

**Files:**
- Create: `app/api/fitness/[provider]/connect/route.ts`
- Create: `app/api/fitness/[provider]/callback/route.ts`
- Create: `app/api/fitness/[provider]/disconnect/route.ts`
- Create: `app/api/fitness/[provider]/sync/route.ts`
- Create: `lib/fitness/oauth-state.ts`
- Create: `lib/fitness/token-store.ts`
- Create: `lib/fitness/providers/provider.ts`
- Create tests beside each pure helper or under `lib/fitness/*.test.ts`

**Security requirements:**

- Require a valid Supabase session.
- Use one-time, expiring state bound to the signed-in user; use PKCE where supported.
- Exchange authorization codes only on the server.
- Encrypt refresh tokens or store them in a dedicated secret store; database rows hold only an opaque reference where possible.
- Redact codes, tokens, and provider payloads from logs.
- Request read-only workout scopes only.
- Make disconnect revoke provider access when supported and erase stored credentials.

### Task 8: Add sync worker and reconciliation

**Objective:** Reliably import backfill and updates without doing long work in webhook callbacks.

**Files:**
- Create: `app/api/fitness/webhooks/[provider]/route.ts`
- Create: `app/api/cron/fitness-sync/route.ts` or a Supabase Edge Function
- Create: `lib/fitness/sync.ts`
- Create: `lib/fitness/sync.test.ts`
- Modify: `vercel.json` only if Vercel Cron is selected

**Steps:**

1. Backfill only the challenge date range.
2. Persist provider cursors/checkpoints.
3. Make retries idempotent.
4. Verify webhook signatures where providers support them.
5. Queue work from webhooks; return quickly.
6. Reconcile periodically for missed updates/deletions.
7. Stop scheduled scoring after the approved final-sync deadline.
8. Surface reconnect-required and last-sync status without exposing technical secrets.

---

## Phase 3: Pilot one cloud provider

### Task 9A: Garmin pilot (only after approval)

**Files:**
- Create: `lib/fitness/providers/garmin.ts`
- Create: `lib/fitness/providers/garmin.test.ts`

**Acceptance tests:** consent, challenge-range backfill, new activity delivery, changed/deleted activity, token expiry, rate-limit handling, unknown activity, duplicate retry, disconnect, and no post-deadline scoring.

### Task 9B: Google Health API pilot (alternative to Garmin)

**Files:**
- Create: `lib/fitness/providers/google-health.ts`
- Create: `lib/fitness/providers/google-health.test.ts`

**Prerequisites:** Confirm API access, supported exercise/workout fields, production OAuth verification, restricted-scope security requirements, test accounts, and exact retention/deletion obligations. Do not use the deprecated Google Fit API.

**Acceptance tests:** Same test matrix as Garmin, plus Google consent revocation and scope-change behavior.

**Rule:** Implement Task 9A **or** Task 9B, not both, until the pilot is stable and participant demand justifies a second provider.

---

## Phase 4: Participant experience

### Task 10: Add connection and review UI

**Files:**
- Create: `components/FitnessConnections.tsx`
- Create: `components/ImportedActivityReview.tsx`
- Modify: `components/Dashboard.tsx`
- Modify: `components/EntryLog.tsx`
- Modify: `lib/data.ts`

**UI requirements:**

- Explain what is imported, how points are calculated, leaderboard visibility, retention, and disconnect behavior before consent.
- Show connection status, provider, last successful sync, and reconnect action.
- Label entries as manual or imported.
- Imported source records are read-only; corrections happen through provider resync or an explicit review workflow.
- Let participants resolve unmapped workouts and likely cross-provider duplicates.
- Never show heart rate, routes, or unnecessary health details to teammates/admins.
- Preserve manual entry as fallback.

### Task 11: End-to-end validation and limited beta

**Validation:**

1. Run `npm test`.
2. Run `npm run lint`.
3. Run `npm run build`.
4. Execute SQL authorization tests with participant A, participant B, admin, anonymous, and service roles.
5. Test OAuth state replay, state expiry, callback signed in as wrong user, revoked tokens, provider downtime, retries, duplicates, updates, and deletions.
6. Verify no secrets in browser bundles, Supabase client responses, Vercel logs, or error tracking.
7. Beta with internal volunteers using test/provider sandbox accounts.
8. Compare imported records to provider-visible workouts and expected challenge credits.
9. Obtain privacy/security sign-off before general release.

---

## Files likely to change

- `supabase/schema.sql` (fold in approved migrations only after testing)
- `supabase/migration-server-owned-scoring.sql`
- `supabase/migration-fitness-provider-survey.sql`
- `supabase/migration-fitness-connectors.sql`
- `components/ActivityForm.tsx`
- `components/EntryLog.tsx`
- `components/Dashboard.tsx`
- `components/OnboardingForm.tsx`
- `components/FitnessConnections.tsx`
- `components/ImportedActivityReview.tsx`
- `app/admin/page.tsx`
- `app/api/fitness/**/route.ts`
- `app/api/cron/fitness-sync/route.ts`
- `lib/constants.ts`
- `lib/data.ts`
- `lib/activity-scoring.ts`
- `lib/fitness/**`
- `.env.local.example` (provider variable names only; never real secrets)
- `README.md`

Do not overwrite or mix this work into the existing untracked `supabase/migration-registration-stats.sql`.

---

## Risks and tradeoffs

- **Schedule:** No provider path is low-risk for the October 5 launch.
- **Approval dependency:** Garmin and Google production access are external gates; code cannot bypass them.
- **Native scope:** Apple and Android broad coverage requires two mobile app workstreams, app-store/release operations, and ongoing maintenance.
- **Privacy:** Workplace wellness data is sensitive even when it is not a medical record. Data minimization and explicit consent are mandatory.
- **Duplicate credit:** The same workout may reach multiple sources; a primary-source preference plus participant review is safer than silent deduplication.
- **Cost:** A wearable-data aggregator could shorten multi-provider engineering but adds vendor fees, another processor of employee health data, and vendor lock-in. Evaluate only after the provider survey.
- **Architecture:** Full multi-tenancy now would be overbuilding; minimal challenge/version identifiers are sufficient for the first pilot.

---

## Source checks performed September 25, 2026

- GitHub issue: `https://github.com/pashcoach/wellness-challenge/issues/1`
- Garmin Activity API: `https://developer.garmin.com/gc-developer-program/activity-api/`
- Garmin program FAQ: `https://developer.garmin.com/gc-developer-program/program-faq/`
- Google Health API: `https://developers.google.com/health`
- Deprecated Google Fit REST API notice: `https://developers.google.com/fit/rest`
- Apple HealthKit: `https://developer.apple.com/documentation/healthkit`
- Android Health Connect: `https://developer.android.com/health-and-fitness/guides/health-connect`
- Strava API Agreement effective June 1, 2026: `https://www.strava.com/legal/api`
