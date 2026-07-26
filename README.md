# FCL CRC Wellness Challenge 2026

A mobile- and desktop-friendly web app for the annual FCL CRC Wellness Challenge
(October 5–30, 2026). Replaces the Glide app — self-hosted, near-zero running cost.

## What it does

**Participants**
- Sign up with email + password (no app store — it's a website, works on any phone or computer)
- One-time profile: name, business unit, "Are you located at CRC?", age range
- Create a team (gets a 6-character join code) or join one — no team size cap
- Log physical activity: pick activity + minutes → points auto-calculated (10 pts per 10 min)
- Weekly wellness check-in: one tap per week with example activities + optional comment (20 pts)
- Personal progress vs. the 140 pts/week (560 total) goals
- Team leaderboard (average points per member — same scoring as 2025)

**Admins (Patrick)**
- Live stats: registered/active counts, CRC split, total minutes
- Participants-logging-per-day chart (the engagement curve for the report)
- Active-by-business-unit breakdown
- Team standings
- Prize draws: weekly draw per week, random team lunch draw, survey draw, top-team display
- One-click CSV export with per-participant totals → feeds the post-challenge report

## Stack

- Next.js (React) + Tailwind — responsive by default
- Supabase (free tier): Postgres database + email/password auth
- Deploys free on Vercel

## Setup

1. Create a free project at https://supabase.com
2. In the Supabase SQL editor, run the contents of `supabase/schema.sql`
3. In Supabase → Authentication → Providers, enable Email (it's on by default).
   For lowest friction during the challenge, turn OFF "Confirm email" in
   Authentication → Sign In / Providers → Email.
4. Copy `.env.local.example` to `.env.local` and fill in the two values from
   Supabase → Settings → API.
5. `npm install && npm run dev` → http://localhost:3000
6. Make yourself admin: in Supabase Table Editor → profiles, set `is_admin = true`
   on your own row (after signing up in the app).
7. Deploy: push this repo to GitHub, import into https://vercel.com (free),
   add the same two env vars in Vercel project settings.

## 2026 rules baked in (from the June 24 planning call)

- Wellness activities: no fixed required list — weekly pillar prompt with examples
  + optional "what did you do?" comment box
- No cap on team size; scoring is average points per team member
- No mid-challenge booster points (decided against)
- CRC data fix: proper business-unit list + separate "located at CRC?" question
- Challenge dates: Oct 5–30, 2026
- Points: 10 pts per 10 min physical activity; 20 pts per weekly wellness check-in
- Goals: 140 pts/week, 560 total
