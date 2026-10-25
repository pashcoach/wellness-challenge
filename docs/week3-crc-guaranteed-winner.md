> SUPERSEDED: Do not deploy this historical rule or its tests/readback to current production. Use [Week3 two CRC units](week3-crc-two-units.md). Historical migration remains immutable.

# Week 3 guaranteed CRC-location winner: top three active business units

## Approved rule

1. Normalize business units with existing `private.normalize_department`: case-insensitive, trimmed/collapsed whitespace, `&` equivalent to `and`; ignore blank units.
2. Rank units by **distinct active CRC participants in Week 3**. Active means at least one `activity_entries` **OR** `wellness_checkins` row with `week = 3`; multiple events and both event types still count once. Only `located_at_crc = true` profiles count. Exclude both `exclude_from_standings` and `exclude_from_prizes` profiles from this ranking (organizers must not inflate it). Points and previous prize wins do **not** affect participation counts.
3. Use **competition `rank() <= 3`, not dense_rank**. All units tied at the third positional cutoff qualify. Examples: counts `5,3,2,2` have ranks `1,2,3,3` (all qualify); `5,5,5,2` have ranks `1,1,1,4` (last does not). Fewer than three active units means all qualify. No alphabetical tie-break.
4. First winner is uniformly random across eligible CRC **people**, not uniformly across units, restricted to these units. First-slot profiles must also not be standings-excluded. Eligibility retains 140+ Week 3 points, a logged Week 3 wellness activity (a checkin alone is insufficient), `exclude_from_prizes = false`, nonblank normalized unit, and no previous win in any draw.
5. Second winner is random from the **full existing eligible pool**, in a different normalized unit. They need not be CRC or in a top-three unit and may be CRC. Existing eligibility is unchanged: the prizes flag controls this pool, not the standings flag. Organizer accounts already carry the prize exclusion; do not infer exclusions from names or admin status.
6. If no top-three eligible CRC candidate exists, fail closed; never substitute a lower-ranked unit. If two compatible eligible units cannot be selected, fail closed. PostgreSQL rolls back the entire invocation, including the run marker. Ranking is computed at draw execution, not frozen at deployment.

Weeks 1, 2 and 4 retain the exact old function behavior. No profile, draw history, grand/team prizes, cutoff code, admin UI, Gmail or cron changes are included.

## Parent/operator deployment — NOT performed here

1. Confirm intended Supabase project and read current function with `supabase/tests/week3-crc-guaranteed-winner-readback.sql`. Compare live function with `supabase/migration-weekly-draw-different-departments.sql`; stop on unrelated differences. Record both history fingerprints and run/result counts. Week1/2 should each have two results and one run; Week3/4 should be absent.
2. Apply the complete `supabase/migration-week3-crc-guaranteed-winner.sql` including `begin`/`commit`. It replaces only `public.run_weekly_draw(integer)` and restates execute grants. Requires existing normalization/admin/points/activity helpers, organizer flags, CRC flag and activity/checkin tables. It runs **no draws** and changes **no participant data**.
3. Run readback again: all `rule_*` fields true, `security_definer = true`, empty search path, `anon_can_execute = false`, `authenticated_can_execute = true`; internal admin check preserved. Inspect full definition as well (text checks are not a behavioral proof). **Both history fingerprints and counts must exactly match pre-apply**. Ranking audit returns only normalized unit/count/rank/inclusion, not participant identities.
4. Optional **separately authorized** rollback-only simulation: run `supabase/tests/week3-crc-guaranteed-winner-rollback-test.sql` alone. This DOES invoke a simulated Week3 draw inside subtransactions, locks draw/profile tables and temporarily modifies profile flags/units; final exception rolls everything back. Do not run if authorization prohibits even simulated draws. It refuses existing Week3 and requires a currently eligible top-three CRC participant plus another eligible unit. Expected terminal exception: `TESTRESULT PASS: ... ALL writes rolled back`. Lack of a valid pool is a blocker, not permission to weaken the rule. Then repeat readback/fingerprint comparison. Week4 is tested locally only.
5. Never execute real Week3/4 draws during deployment verification. If function deployment must be reverted before any draw, reapply the previously inspected baseline function migration; do not revert or delete any recorded winners. Read back afterward.

## Local verification

Standard `npm test` includes SQL contract/safety tests and checks that removing only Week3 additions yields the exact baseline function. Scratch-only PGlite executes the actual migrations, rollback script and readback SQL; fixture-backed point/activity helpers intentionally do not model production scoring triggers or authentication. Coverage includes top-three restriction, low-point active participants, checkin-only ranking, duplicate events, normalization, both organizer flags, non-CRC/other-week exclusion, competition ties, existing winners, full second pool, one-shot/atomic failures and unchanged Week4. Production grants/triggers/deployed state still need operator readback.

```sh
CRC_TEST_DEPS="$TMPDIR/crc-draw-test"
npm install --prefix "$CRC_TEST_DEPS" --no-package-lock --no-save @electric-sql/pglite@0.5.10
NODE_PATH="$CRC_TEST_DEPS/node_modules" node --test supabase/tests/week3-crc-draw.test.mjs
# RED control: old function must fail the rank-four fail-closed behavior.
CRC_DRAW_BASELINE=1 NODE_PATH="$CRC_TEST_DEPS/node_modules" node --test --test-name-pattern='rank-four' supabase/tests/week3-crc-draw.test.mjs
npm test
npm run build
npx eslint lib/week3-crc-draw.test.ts supabase/tests/week3-crc-draw.test.mjs
```

Baseline RED intentionally exits nonzero. Dependency is scratch-only; repository package files are unchanged. No production SQL or actual draw was executed by this implementation.
