# 2026 FCL Wellness Challenge — Key Wrap-up Tasks

Created: 2026-10-10. Owner/approver: Patrick Ash, Endurance Journey.
Challenge end date: October 30, 2026. All review times are Saskatchewan time (America/Regina, UTC−06:00).

## How to use this running list

- This Obsidian note is the working source of truth. A sanitized mirror is kept at `docs/operations/2026-challenge-wrap-up-checklist.md` in the wellness-challenge repository. Update both when tasks/statuses change; keep stable W01–W18 identifiers and append new IDs for new tasks.
- Patrick approves external communications, spending, plan changes, service shutdowns, access revocations, and data deletion. Hermes can prepare recommendations and evidence; this checklist is NOT permission to execute its tasks automatically.
- Mark a task complete only with a date and verified evidence; record blockers and a next review date rather than assuming success.
- Do not store participant names, addresses, raw support text, exports, tokens, credentials, or recovery links here or in GitHub/Discord. Use private authorized storage for restricted evidence and aggregate/anonymize reports.
- Initial review: October 31 at 9:00 a.m. CST, after the existing 6:30 a.m. final-draw and 6:35 a.m. draft-update jobs. Those jobs must be verified, not presumed successful.
- Proposed reporting/review checkpoint: November 6, subject to the committee's actual deadline. Cost cleanup must wait for required reporting, prizes, backups, and agreed support access. Next-invoice verification is scheduled only after the real billing dates are known.

## 1. Results, prizes, and participant closure

- [ ] **W01 — Verify challenge closure and final totals.** Read the actual configured closing cutoff and confirm the participant view and server restrictions agree. Reconcile registrations versus active participants, dates, activity minutes, points, weekly check-ins, duplicate/corrected entries, team averages, and organizer exclusions. Record an approved final snapshot, not a live number that may change.
- [ ] **W02 — Verify all prize outcomes and fulfillment.** Read permanent weekly, grand-prize, top-team, and random-team results; verify eligibility/exclusions and distinct team prizes. Never rerun a recorded draw. Track committee approval, notifications, claims, and actual gift-card/day-off/lunch fulfillment privately.
- [ ] **W03 — Approve final participant communications.** Review the existing results/winners draft, survey link, instructions, and current BCC audience. Make the Endurance Journey–FCL partnership clear. Send only after separate approval; check Sent, bounces, and duplicates afterward.
- [ ] **W04 — Close out support and agree a follow-up window.** Review active in-app tickets and Gmail replies; distinguish replied-to from resolved. Resolve or assign every outstanding case, agree how long the app/help channel stays accessible, and avoid stopping monitoring before that date.

## 2. Reporting and program review

- [ ] **W05 — Prepare the final FCL committee report.** Confirm audience, deadline, and Word/PDF format. Include an executive summary, registration trends if captured, weekly participation, minutes/points, goal attainment, wellness check-ins, activity mix, team-versus-solo and CRC/non-CRC comparisons, and approved business-unit/demographic summaries. Show definitions, denominators, extraction cutoff, exclusions, and data limitations; suppress small groups where needed for privacy.
- [ ] **W06 — Summarize support and app improvements.** Capture the private improvement report, Gmail/in-app deduplication, open versus resolved issues, recurring account/team/points problems, fixes shipped, and remaining gaps. Publish only anonymized themes, not message bodies or participant identifiers.
- [ ] **W07 — Review feedback and program impact.** Confirm any survey exists and has a closing date; summarize responses, response rate, feedback, and recommendations after it closes. Do not invent survey findings or infer health outcomes from points alone.
- [ ] **W08 — Complete the committee debrief and 2027 backlog.** Review what worked, costs, participation barriers, communications, prize administration, and operational lessons. Record decisions, owners, and dates; link relevant improvements to the existing November 2 wearable-integration planning session rather than starting a duplicate workflow. Obtain approval of the final deliverables.

## 3. Security, backups, and retention

- [ ] **W09 — Verify backups and create a protected final archive.** Read Supabase backup status and recovery points; preserve required database records, final reports, draw audit history, and source/release references in restricted storage. Verify an export can be opened or restored in a non-production environment before any downgrade or deletion.
- [ ] **W10 — Agree participant-data retention and deletion dates.** Confirm FCL's requirements and consent commitments, who can access the archive, the follow-up window, and which identifiers can be removed. Document dates and approval; delete temporary/debug exports only after verifying what must be retained. No automatic blanket deletion.
- [ ] **W11 — Review privileged access and credentials.** Audit administrator/team membership and least-privilege database permissions. Inventory campaign-only Gmail OAuth, SMTP/API, export, and insight-import credentials; revoke or rotate unnecessary/exposed credentials only after mapping dependencies and obtaining approval. Do not rotate keys still serving another project.
- [ ] **W12 — Verify the secure post-challenge service state.** Test public/private boundaries, protected reports, closed entry paths, authentication, and participant-facing closure/support instructions. Keep appropriate uptime/security monitoring and domain/TLS protection while the site remains online; document restore and incident ownership.

## 4. Billing and automation cleanup

- [ ] **W13 — Review Vercel deployment retention.** Revisit the temporary opt-out from the October 23 reduction. Patrick reported clicking Keep retention and seeing the notice disappear; independently read current settings before changing anything. Proposed policy, subject to approval and rollback needs: production 90 days, preview/pre-production 30 days, canceled/errored 7 days. Check whether a change is team-wide or project-only and protect other projects. Read back saved settings.
- [ ] **W14 — Audit subscriptions, usage, renewals, and budget alerts.** Review Vercel, Supabase, email/SMTP, monitoring, domain, and any campaign-related model/API services actually used. Record current plan, seats/add-ons, storage/function/egress usage, latest charge, renewal/billing date, and spending alerts. Separate shared business services from challenge-only costs; do not assume low traffic stops billing.
- [ ] **W15 — Prepare and approve a cost-reduction plan.** Compare keeping the app available against downgrading or archiving. Explain feature, backup, restoration, quota, availability, and billing-effective-date consequences before approval. Do not pause/delete Supabase or hosting, cancel the domain, or disable shared services merely because the challenge has ended.
- [ ] **W16 — Audit scheduled jobs and stop only approved leftovers.** Read the current scheduler, including forever-running weekly quality reviews, overnight fixes, email labeling, model-credit monitors, catch-ups, bounce monitors, and support-insight sync. Propose keep/pause/remove with dependencies and end dates. Preserve scheduled final results and relevant 2027 planning; do not touch unrelated coaching jobs. Verify any approved changes afterward.
- [ ] **W17 — Review unused deployment output and private artifacts.** After archive/recovery verification, propose removal of obsolete previews, unused assets, temporary exports, debug files, and draft duplicates. Preserve release references, required audit records, and approved participant records; assess preview access before exposing old builds.
- [ ] **W18 — Verify the next invoice and complete financial closeout.** After approved changes take effect, compare the next actual invoices with expected plans, seats, add-ons, and usage. Investigate unexpected charges, record final campaign operating/prize costs, and confirm no unintended recurring bills remain. Set a follow-up reminder once the actual invoice dates are known.

## Schedule and related workflows

- Wrap-up reminder: October 31, 2026 at 9:00 a.m. CST, once, delivered to the Wellness Challenge Changes Discord thread. It reviews outstanding tasks only; it does not make account or production changes.
- Reminder scheduler ID: `9fa5643feff7` (enabled one-shot; explicit Discord destination `1530989694064787621`).
- Final draw job: `077585898d61`, October 31 at 6:30 a.m. CST; final email-draft update: `4dd65d4c649b`, 6:35 a.m. CST. These are independent jobs and may fail; inspect actual results.
- 2027 wearable-integration planning: `8883e73f2c6c`, November 2 at 9:00 a.m. CST. This checklist does not alter that job.
- Support-insight sync: `2738c53760da`; inspect its actual schedule and remaining runs during W16 rather than relying on an estimated finish date.
- The reminder needs the coding-profile Hermes gateway running on the Mac and access to the current checklist. Creation does not prove future delivery.
- Prize workflow: `docs/operations/2026-prize-draw-email-workflow.md` in the repository; “2026 Prize Draw and Email Draft Workflow” in Obsidian.

## Decision and completion log

- 2026-10-10: Patrick requested a living wrap-up list covering billing, security, reports, and review, plus an end-of-challenge reminder. All tasks remain open. Only creating the checklist and reminder is authorized by this request.
- Vercel reference material (re-check at review time): https://vercel.com/docs/deployment-retention and https://vercel.com/docs/deployment-storage. Policy durations above are proposals, not a claim about the currently saved settings.
