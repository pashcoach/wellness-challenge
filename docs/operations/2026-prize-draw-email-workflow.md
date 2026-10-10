# 2026 Prize Draw and Email Draft Workflow

This runbook documents the scheduled production prize draws for the 2026 FCL Wellness Challenge and the controlled insertion of verified results into Gmail drafts.

The related [Key Challenge Wrap-up Tasks](2026-challenge-wrap-up-checklist.md) tracks results verification, prize fulfillment, reporting, security, and billing cleanup. Its initial review reminder is October 31 at 9:00 a.m. CST; it does not replace or rerun the draw jobs below.

## Scope and ownership

- Production app: <https://fclwellnesschallengeapp.ca>
- Repository: <https://github.com/pashcoach/wellness-challenge>
- Operator: Patrick Ash
- Scheduler: Hermes cron
- Time zone: Saskatchewan time (CST, UTC−06:00)
- Draws are one-shot, permanent production actions.
- Email automation updates existing drafts only. It never sends an email.

## Prize eligibility rules

### Weekly draws

Each weekly draw selects two participants who:

- earned at least 140 points in that week;
- logged at least one wellness activity in that week; and
- have not already won an individual prize draw.

### Grand prize

The grand-prize draw selects two participants who:

- earned at least 140 points in each of Weeks 1–4;
- logged at least one wellness activity in each of Weeks 1–4; and
- did not win a weekly prize.

### Team lunches

- The top team is determined by highest average points per member, with deterministic tie ordering.
- The random-team lunch draw excludes the top team.
- The two team lunches therefore go to different teams.

The complete candidate pool and exclusions are enforced by database functions, not by the browser or email workflow.

## Schedule

| Date and time (CST) | Production action | Draft update at 6:35 a.m. |
|---|---|---|
| Monday, October 12, 2026 at 6:30 a.m. | Week 1 draw | Add both winners to Email #4 |
| Monday, October 19, 2026 at 6:30 a.m. | Week 2 draw | Add both winners to Email #5 |
| Monday, October 26, 2026 at 6:30 a.m. | Week 3 draw | Add both winners to Email #6 |
| Saturday, October 31, 2026 at 6:30 a.m. | Week 4, grand-prize and random-team draws; record top team | Add all weekly, grand-prize and team results to Email #8 |

On October 31, missing final draws run in this order: Week 4, grand prize, then random team.

## Draw controls

Every draw job must:

1. Open the production `/admin` page as the trusted administrator.
2. Read Completed draws before taking action.
3. Never rerun a draw key that is already recorded.
4. Use the production confirmation dialog for a missing authorized draw.
5. Read production history back after the action.
6. Verify the expected result count:
   - two records for each weekly draw;
   - two records for the grand-prize draw; and
   - one record for the random-team draw.
7. Stop without improvising if authentication, eligibility, loading, confirmation or verification fails.
8. Never execute a replacement draw through ad hoc SQL.

The October 31 job also requires verified Week 1–3 results before it proceeds.

## Gmail draft controls

Each draft-update job runs five minutes after its associated draw and must:

1. Independently verify the winners in production.
2. Update the existing draft identified in the private local draft manifest.
3. Change only the applicable winner placeholders.
4. Preserve the subject, all unrelated body text, To recipient and complete BCC set.
5. Keep CC empty.
6. Update the existing draft rather than create a duplicate.
7. Read the draft back and verify the DRAFT label, unchanged recipients, unchanged subject and inserted winners.
8. Never invoke the Gmail send action.

Participant email addresses and credentials must never be written to GitHub, Obsidian, Discord reports or job summaries.

## Scheduled Hermes jobs

| Job | Job ID | Runs |
|---|---|---|
| FCL Week 1 prize draw | `ed3205460d95` | Oct 12, 6:30 a.m. CST |
| Add Week 1 winners to email draft | `04d73963846f` | Oct 12, 6:35 a.m. CST |
| FCL Week 2 prize draw | `002fb0f00956` | Oct 19, 6:30 a.m. CST |
| Add Week 2 winners to email draft | `b9fd67238361` | Oct 19, 6:35 a.m. CST |
| FCL Week 3 prize draw | `8059ce3d35e6` | Oct 26, 6:30 a.m. CST |
| Add Week 3 winners to email draft | `b876f1e7211b` | Oct 26, 6:35 a.m. CST |
| FCL final prize draws | `077585898d61` | Oct 31, 6:30 a.m. CST |
| Add all winners to final email draft | `4dd65d4c649b` | Oct 31, 6:35 a.m. CST |

All eight jobs are one-shot jobs. Their success or failure notices are delivered back to the Wellness Challenge Changes Discord thread.

## Failure response

If a draw or draft update fails:

- do not rerun a completed draw;
- inspect production Completed draws first;
- distinguish a failed draw from a successful draw followed by a reporting failure;
- use recorded production results when the draw already committed;
- make only the missing draft update after results are verified; and
- keep the email as a draft for Patrick's review and manual send.

## Pre-send requirement

Before Patrick sends any bulk email, refresh and validate the participant BCC list. Participant addresses belong only in BCC. Creating or updating a draft does not authorize sending it.

## Organizer accounts (added 2026-10-04)

- `profiles.exclude_from_prizes` — skipped by weekly, grand, and random-team draws (a team qualifies only through activity by prize-eligible members).
- `profiles.exclude_from_standings` — hidden from leaderboards, team averages, and admin stats.
- "Patrick Ash" (participant): in standings, out of draws. "P Ash" (admin): out of both.
- Migration: `supabase/migration-exclude-organizer-accounts.sql` (also fixes `user_week_points` to work under the draws' empty search_path; without it every draw errored).
