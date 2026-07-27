# v1.2 — Review Suggestion Branch

This branch implements 5 code review suggestions found by Opus 5 and critiqued by Sol 5.6.
Each is optional — merge what you like, skip the rest.

---

## Suggestion 1: Local-time date helper (~15 lines)

**Problem:** `new Date().toISOString().slice(0, 10)` uses UTC. Saskatchewan is UTC-6. After 6pm local, every date-using feature breaks — evening entries land on tomorrow's date, Sunday 7pm entries go in the wrong week's prize draw, and Oct 30 after 6pm locks participants out entirely.

**Fix:** Added `todayIso()` helper in `lib/constants.ts` using local Date methods. Replaced the 4 call sites (Dashboard, ActivityForm, WellnessCheckin, currentChallengeWeek).

**Files changed:**
- `lib/constants.ts` — added `todayIso()` helper, updated `currentChallengeWeek()`
- `components/Dashboard.tsx` — replaced `todayIso` → `todayIsoStr`
- `components/ActivityForm.tsx` — replaced `today` source
- `components/WellnessCheckin.tsx` — replaced `today` source

---

## Suggestion 2: Pre-aggregated leaderboard view (~90 lines)

**Problem:** The leaderboard downloads 4 unfiltered tables to the browser and aggregates in JS. At 300 participants × 4 weeks, that's ~6,000 activity rows per mount — and it re-runs after EVERY activity log. Also exposes `full_name` and `age_range` of all participants via the `profiles_read_all` RLS policy.

**Fix:** Created `leaderboard_totals` and `team_standings` Postgres views that pre-aggregate everything server-side and expose only display names (username or "First L." format). Client now fetches one pre-computed row per participant and per team.

**To activate:** Run `supabase/migration-leaderboard-view.sql` in Supabase SQL editor.

**Files changed:**
- `supabase/migration-leaderboard-view.sql` — new migration file
- `components/Leaderboard.tsx` — rewritten to fetch from views

---

## Suggestion 3: Check-in nudge banner (~35 lines)

**Problem:** The weekly wellness check-in is worth 20pts (80 total). On mobile the check-in card is below the fold — users who log a walk and close the tab never see it. Missed weeks are permanently lost (DB unique constraint).

**Fix:** A dismissible banner under the points summary that appears when the current week's check-in is missing. Tapping it smooth-scrolls to the check-in section. Uses data already in-memory — zero new queries.

**Files changed:**
- `components/Dashboard.tsx` — added nudge banner + scroll target id

---

## Suggestion 4: User-friendly errors + join-code fix (~60 lines)

**Problem:** 16 call sites show raw Postgres errors to non-technical office workers ("duplicate key value violates unique constraint 'wellness_checkins_user_id_week_key'"). For a workplace wellness challenge this reads as "app is broken."

Also: team join codes generated client-side with `Math.random().toString(36).slice(2, 8)` occasionally produce short (1–5 char) codes with higher collision odds. The DB already has a `gen_join_code()` function that nothing calls.

**Fix:** Created `lib/errors.ts` with `friendlyError()` that translates Postgres codes (23505 → "You've already checked in this week"), network errors, and auth errors into plain English. All 16 call sites swapped. Added `default gen_join_code()` to the teams table schema, removed client-side code generation.

**Files changed:**
- `lib/errors.ts` — new file with friendly error mapper
- `components/ActivityForm.tsx` — swapped error calls
- `components/WellnessCheckin.tsx` — swapped error calls
- `components/EntryLog.tsx` — swapped error calls
- `components/SoloTeamCard.tsx` — swapped error calls, removed client join-code gen
- `components/TeamSetup.tsx` — swapped error calls, removed client join-code gen
- `components/OnboardingForm.tsx` — swapped error calls
- `components/AuthForm.tsx` — swapped error calls (reset-password path)
- `components/FeedbackButton.tsx` — swapped error calls
- `app/reset-password/page.tsx` — swapped error calls
- `supabase/schema.sql` — added `default gen_join_code()` to `teams.join_code`

---

## Suggestion 5: Pass profile as prop (~12 lines)

**Problem:** `Dashboard.tsx` calls `useProfile()` independently from `page.tsx`'s `useProfile()`. Two separate network requests for the same data — plus a blank white screen flash while the second request resolves.

**Fix:** Pass `profile` as a prop from `page.tsx` to `<Dashboard>`. Removed Dashboard's `useProfile()` call. Also wired `onProfileChange` so team setup / onboarding changes propagate properly.

**Files changed:**
- `app/page.tsx` — passes `profile` and `refresh` to Dashboard
- `components/Dashboard.tsx` — accepts props, removed `useProfile()`

---

## To merge individual suggestions

Each suggestion touches different files, so cherry-picking is straightforward:

| Suggestion | Key files | Lines changed |
|-----------|-----------|---------------|
| 1 — Timezone fix | constants.ts, Dashboard, ActivityForm, WellnessCheckin | +18/-4 |
| 2 — Leaderboard view | Leaderboard.tsx, migration SQL | +137/-132 |
| 3 — Check-in nudge | Dashboard.tsx | +18/-1 |
| 4 — Friendly errors | errors.ts + 10 components + schema | +86/-11 |
| 5 — Profile prop | page.tsx, Dashboard.tsx | +6/-5 |

You can `git checkout main -- <file>` to revert any individual file you don't want.
