# GoJoe Competitive Research and Wellness Challenge Roadmap

**Research date:** October 2, 2026
**Target:** <https://www.gojoe.com/us>
**Purpose:** Identify public product patterns that can inform the Wellness Challenge without copying GoJoe branding, wording, visual identity, or proprietary implementation.

## Research method and scope

- Checked `robots.txt`; public crawling is allowed and the sitemap is published.
- Used **Scrapling** for a rate-limited crawl of 10 curated public product and case-study pages.
- Used **BetterWright** to verify the dynamically rendered US homepage in a real browser.
- Accessed only public marketing pages. No accounts, forms, private APIs, or personal data were accessed.
- GoJoe performance statistics are vendor-reported marketing or case-study claims, not independent benchmarks.

Reproducible research files:

- `scripts/research/scrape_gojoe.py`
- `scripts/research/capture_gojoe.js`
- `docs/research/gojoe-public-pages.json`
- `docs/research/gojoe-browser-capture.json`

## What the Wellness Challenge already does well

The current app already has a strong challenge foundation:

- Email/password authentication and account recovery.
- Privacy-aware onboarding with optional public username.
- Manual activity logging, quick entries, custom activities, editing, and deletion.
- Four weekly wellness-pillar check-ins.
- Weekly and overall personal progress, streaks, recaps, and post-challenge wrap-up.
- Achievement badges.
- Individual and average-per-member team leaderboards.
- Team creation, join codes, roster, and recent team activity.
- Admin analytics, CSV export, prize draws, and draw history.
- Installable PWA and mobile-oriented experience.

The automated test suite currently passes **50 of 50 tests**.

## Priority zero: protect the current launch

These issues should be resolved before adding competitive features because they affect authorization, participant privacy, scoring integrity, and prize administration.

1. **Prevent admin privilege escalation.** A participant can currently update their own `profiles` row, including `is_admin`.
2. **Tighten database read policies.** Current policies permit broad access to full profiles, activities, wellness check-ins, demographics, and comments. Participants should receive only their own records plus privacy-safe leaderboard/team projections.
3. **Restrict prize functions to verified administrators.** Prize RPC functions are exposed too broadly and need server-side admin authorization.
4. **Calculate scores in the database.** Do not trust client-submitted points, week numbers, or dates. Validate challenge windows, future dates, caps, and duplicate submissions server-side.
5. **Repair prize-draw persistence.** The unique `draw_key` conflicts with multi-winner inserts, and the admin screen reads fields from the wrong relation.
6. **Repair badge awards.** Existing SQL can multiply point totals through a cross-join; streak badges are not awarded; time badges count entries rather than distinct days.
7. **Complete launch hygiene.** Disable testing mode explicitly, remove test records, execute a real prize-draw rehearsal, and verify the production database policies before October 5.

## Product roadmap

### P1 — retention and inclusive participation

#### 1. Weekly missions and comeback paths

Add small weekly missions that can be completed regardless of leaderboard rank:

- Complete two active days.
- Try one new activity.
- Complete one wellness check-in.
- Encourage a teammate.
- Complete a recovery or mindfulness action.

Reward consistency, variety, and participation—not only total minutes. Add milestone celebrations and a fresh weekly progress state so lower-ranked participants still have achievable wins.

**Why:** GoJoe publicly emphasizes recurring missions, streaks, badges, levels, and milestone rewards rather than relying only on a final leaderboard.[1][2]

#### 2. Inclusive activity catalog with transparent scoring

Move from a mostly time-based list to an admin-configurable activity catalog with:

- Activity category and accessibility tags.
- Time, distance, repetition, or completion-based units.
- Published conversion rules.
- Caps and anomaly thresholds.
- Manual logging as an accessible fallback.

Include low-barrier and adaptive options such as mobility work, gardening, handcycling, chair exercise, stretching, and active commuting.

**Why:** GoJoe promotes a broad activity catalog and normalized participation across different abilities.[1][2]

#### 3. Collective journey map

Let the whole company or each team advance along a visual route using combined activity. Possible Wellness Challenge versions:

- A Saskatchewan community route.
- A client-branded route between office locations.
- A four-stage journey aligned with the four wellness pillars.
- A charity-impact journey where milestones unlock employer donations.

The map should complement, not replace, personal and team leaderboards.

**Why:** GoJoe uses collective goals and interactive routes to give distributed teams a shared outcome.[2][3]

#### 4. Team encouragement layer

Extend the existing team feed with controlled social features:

- Reactions and encouragement prompts.
- Optional photo posts with moderation/reporting.
- Team announcements.
- Weekly team highlights.
- No public direct messaging in the first version.

Start with lightweight reactions before adding chat. This produces social accountability with less moderation and privacy risk.

**Why:** GoJoe describes activity feeds, team/organization communication, and social encouragement as engagement mechanisms.[2][7]

#### 5. Configurable milestone rewards

Expand prize draws into an admin-configurable reward engine:

- Reward completion, consistency, improvement, participation, or peer recognition.
- Set weekly and campaign budgets.
- Display progress toward eligibility.
- Keep an immutable award and adjustment history.
- Support non-monetary recognition before adding gift-card fulfillment.

**Why:** GoJoe describes milestone, participation, activity, and recognition-based incentives with budget controls.[1][5]

### P2 — campaign operations and trustworthy reporting

#### 6. Campaign communications console

Allow administrators to schedule:

- Launch instructions.
- Weekly mission announcements.
- In-app cards and reminders.
- Team captain prompts.
- Mid-challenge comeback messages.
- Weekly and final recaps.

Users should have notification preferences, and sensitive health or wellness details should never appear in employer-facing messages.

**Why:** GoJoe case studies describe structured campaign emails, notifications, pop-ups, and weekly themes.[7]

#### 7. Fair-play review queue

Add integrity controls that flag—not automatically punish—entries such as:

- Impossible minutes or distances.
- Duplicate entries.
- Repeated maximum-value submissions.
- Entries outside the challenge window.
- Sudden extreme deviations from prior activity.

Temporarily remove disputed points from competitive totals, notify the participant, and provide an appeal/review path.

**Why:** A GoJoe case study describes automatically hiding activity under review from rankings.[6]

#### 8. Privacy-safe outcome dashboard

Add employer-level reporting for:

- Registration and activation.
- Weekly active participation.
- Retention by week.
- Activity mix.
- Check-in completion.
- Percentage reaching personal goals.
- Previously inactive participant engagement.
- Team and business-unit comparisons only above a minimum cohort size.

Never expose individual wellness answers, comments, goals, precise locations, or health-risk data to employers. Apply minimum cohort suppression to demographic reporting.

**Why:** GoJoe markets combined behavioral and survey reporting, but the Wellness Challenge can differentiate through stricter privacy defaults.[1][4]

#### 9. Challenge builder

Replace hard-coded dates, goals, points, and four-week assumptions with a reusable campaign model:

- Multiple organizations.
- Multiple concurrent or scheduled challenges.
- Challenge templates.
- Configurable dates, time zone, scoring, check-ins, team rules, rewards, and communications.
- Draft, preview, test, launch, close, and archive states.

This is the key architectural step from a single event app to a sellable corporate wellness platform.

### P3 — enterprise readiness

Build these only after the challenge engine, security model, and privacy architecture are stable:

- Organization-level multi-tenancy and scoped administrators.
- SSO/SAML/OIDC, MFA requirements, eligibility imports, and later SCIM.
- Wearable integrations with explicit consent and manual-entry fallback.
- Localization for language, time zones, units, and campaign communications.
- Audit logs, retention/deletion controls, participant data export/deletion, backups, and recovery procedures.
- Scheduled reports, API/webhook exports, and privacy-thresholded cohort analytics.
- A curated benefits or wellbeing-resource hub.

## Recommended original feature concepts

These ideas adapt the strongest engagement patterns while giving the Wellness Challenge its own identity:

### Momentum Score

A private personal score based on consistency, variety, and improvement—not raw volume. This helps newer or less-active participants see success without competing directly against high-volume athletes.

### Wellness Passport

Participants collect a stamp for engaging with each wellness pillar. Completing all four pillars unlocks recognition or prize eligibility. This builds on the app's existing check-ins.

### Team Huddle

A weekly team card showing progress, a suggested group mission, celebration prompts, and privacy-safe teammate highlights. It creates social accountability without requiring an unrestricted chat system.

### Everyone Moves the Map

Every valid activity advances a shared visual route. Personal and team competition remain optional views, while every participant contributes to the common destination.

### Comeback Week

Participants who have disengaged receive a short, achievable re-entry mission rather than a generic reminder. Completion earns recognition but does not unfairly inflate competitive scores.

### Community Impact Unlocks

Company-wide milestones unlock employer-funded donations, volunteer actions, or wellbeing resources. This changes the story from “who won?” to “what did we accomplish together?”

## What not to build yet

Avoid expanding into these areas until the core security and campaign architecture are complete:

- Health-risk assessments or biometric screening data.
- Employer-visible individual health predictions.
- AI disengagement scoring using sensitive participant data.
- A global gift-card marketplace.
- Real-time direct messaging.
- Benefits claims or insurance integrations.

These features create substantial compliance, moderation, security, and operational obligations and are not required to improve the current challenge.

## Recommended order

1. Fix authorization, privacy, scoring, prize, and badge defects.
2. Complete October 5 launch hygiene and run production smoke tests.
3. Add weekly missions and a collective journey map.
4. Add lightweight team encouragement and scheduled campaign communications.
5. Add fair-play review and privacy-safe engagement reporting.
6. Generalize the app into a multi-organization challenge builder.
7. Add enterprise identity, integrations, localization, and audit controls.

## Sources

1. GoJoe US homepage: <https://www.gojoe.com/us>
2. Corporate challenges: <https://www.gojoe.com/us/one-off-corporate-challenges>
3. Interactive maps: <https://www.gojoe.com/us/our-solutions/interactive-maps>
4. Data and reporting: <https://www.gojoe.com/us/our-solutions/data-reporting>
5. Rewards platform: <https://www.gojoe.com/us/our-solutions/employee-rewards-platform>
6. NatWest case study: <https://www.gojoe.com/us/case-studies/natwest-2024>
7. PwC case study: <https://www.gojoe.com/us/case-studies/pwc>
8. Integrations: <https://www.gojoe.com/us/our-solutions/integrations>
9. Journeys: <https://www.gojoe.com/us/our-solutions/journeys>
10. Clubs: <https://www.gojoe.com/us/our-solutions/clubs>

## Tool references

- BetterWright: <https://github.com/BetterWright/betterwright>
- Scrapling: <https://github.com/D4Vinci/Scrapling>
