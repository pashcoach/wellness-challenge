# Week3: two CRC winners, Energy & Ag + Consumer Products

Supersedes `migration-week3-crc-guaranteed-winner.sql` and the historical top-three rule. Do not reapply that migration or use its old production verification scripts. Historical artifacts remain for audit/regression coverage only.

## Approved rule

- BOTH Week3 winners have `located_at_crc = true`; one normalized `energy and ag`, one `consumer products`. FCL and all other units are excluded regardless of location. Existing normalization folds case/whitespace and treats `&` as `and`.
- Each has >=140 Week3 points AND >=1 logged Week3 wellness activity (a checkin alone does not qualify), neither prize nor standings exclusion, and no prior winner record in ANY draw. Both slots use the same exclusions as the former reserved first pool. No inference from names/admin status.
- Random eligible person across the union first, then random eligible person from the other unit. No participation ranking, top-three limit, weighting by points or nonCRC fallback. Both named unit pools must exist or fail closed without consuming a run.
- Admin-only security-definer function, empty search path, grants, atomic run marker and permanent one-shot history remain. Weeks1/2/4 baseline behavior is unchanged (including standings-hidden eligibility outside Week3). No frontend change: no surfaced top-three promise was found. No email or cron changes; parent handles scheduling.

## Parent apply/readback (not executed by coding agent)

Use the already authenticated wellness-admin browser's Supabase SQL editor for the intended project, postgres role. Paste each complete file and execute separately, never combine scripts:

1. Execute `supabase/tests/week3-crc-two-units-readback.sql` BEFORE apply. Record full installed function, security/grants/search path, both ledger fingerprints and per-draw counts. New `rule_*` checks may be false before install. Confirm Week3 absent from BOTH runs and results; STOP if recorded. Expected existing Week1/2 two winners each, one run each; Week4 absent. Compare current definition to historical `migration-week3-crc-guaranteed-winner.sql`; stop on unrelated differences. Pool audit prints only two unit counts, no identities.
2. Execute complete `supabase/migration-week3-crc-two-units.sql`, including BEGIN/COMMIT. It takes draw-ledger locks and refuses existing Week3 records under lock before replacing only the weekly RPC/grants. It does NOT draw or modify profiles/history. Do not strip its guard or locks.
3. Execute the readback file again. Require ALL `rule_*` true, `security_definer=true`, empty `search_path`, `anon_can_execute=false`, `authenticated_can_execute=true`. Inspect full function against migration too; text checks alone are not behavioral proof. Require BOTH fingerprints and all run/result counts exactly unchanged. Both named pools must have >0 eligible candidates before any later authorized real draw; zero is a blocker, never permission to weaken the rule.
4. Do NOT execute a production draw or send email. The optional `supabase/tests/week3-crc-two-units-rollback-test.sql` requires separate permission for a simulated draw: it locks profile/draw tables, refuses existing Week3, simulates once, checks both CRC units/eligibility/one-shot, and tests empty pool/missing Consumer Products failures. Its final `TESTRESULT PASS: ... ALL writes rolled back` exception is expected. No writes persist. Not authorized as part of this coding task; run locally only. Read fingerprints again if ever authorized in production.
5. If install must be reverted before a draw, an explicitly approved reapply of the inspected historical function restores the OLD top-three rule, not the new desired policy. Never erase or rerun committed winners. Any rollback needs function/grant/fingerprint readback.

## Local verification

Scratch PGlite executes baseline, historical migration, then superseding migration against fixture helpers (not live scoring/auth triggers). Tests exercise named units/location in both slots, exact threshold/activity/exclusions/prior winners, randomness reachability, atomic missing pools, admin check, grants, install guard, rollback/readback scripts and unchanged Week4. Standard `npm test` includes exact function comparison after removing Week3-only additions; old tests are explicitly historical.

```sh
DEPS=/Users/pash/.hermes/profiles/coding/cache/scratch/crc-draw-test
npm install --prefix "$DEPS" --no-package-lock --no-save @electric-sql/pglite@0.5.10
NODE_PATH="$DEPS/node_modules" node --test supabase/tests/week3-crc-two-units.test.mjs supabase/tests/week3-crc-draw.test.mjs
# RED control: historical installed rule must fail new both-winners contract.
CRC_DRAW_BASELINE=1 NODE_PATH="$DEPS/node_modules" node --test --test-name-pattern='BOTH winners' supabase/tests/week3-crc-two-units.test.mjs
npm test
npm run lint
npm run build
```

No production SQL/draw, email, scheduler or frontend mutation is part of this implementation.
