# v1.4 — Badge / Achievement System

This branch adds a recognition system to the Wellness Challenge — badges that auto-award for milestones, streaks, and standout achievements. Pure points are invisible; badges are visible. It makes the leaderboard less abstract and gives participants something to aim for beyond "140pts this week."

**No new Supabase service needed.** Everything runs on existing tables + a new `badges` + `user_badges` schema.

---

## Suggestion: Badge / Achievement System (~250 lines)

**Problem:** The app is purely points-based. Points are abstract — after the first week, hitting 140 vs 135 feels like nothing. There's no sense of accomplishment beyond the number going up, no social signal, and no reason to check the app after logging activity for the day.

**Fix:** A badge system with 12 earnable badges across 4 categories. Badges appear on the Dashboard, the Leaderboard (next to names), and a new Badges page. Awarded on the server via a new `award_badges()` SQL function, triggered after every activity/check-in insert.

### Badge Catalog

**Milestone Badges (points-based — auto-awarded)**
| Badge | Trigger | Notes |
|-------|---------|-------|
| 🥉 **Bronze** | First activity logged | Everyone gets this day one — onboarding hook |
| 🥈 **Silver** | 140 lifetime points | One week's goal |
| 🥇 **Gold** | 280 lifetime points | Two weeks — halfway to the finish |
| 💎 **Platinum** | 420 lifetime points | Three weeks — almost there |
| 🏆 **Champion** | 560 total points | Completionist badge — reached the goal |
| ⭐ **Overachiever** | 700+ lifetime points | 25% above goal — for the extra-mile crowd |

**Streak Badges (consistency-based)**
| Badge | Trigger |
|-------|---------|
| 🔥 **On Fire** | Activity logged 3 days in a row |
| 🔥🔥 **Blazing** | Activity logged 5 days in a row |
| 🔥🔥🔥 **Inferno** | Activity logged 10 days in a row |

**Social Badges**
| Badge | Trigger |
|-------|---------|
| 🤝 **Team Player** | Your team's average is in the top 3 at the end of any week |
| 🗣 **Trailblazer** | Recruited 3+ people who actually log activity (by share link or word-of-mouth — manual claim via admin) |

**Hidden / Surprise Badges**
| Badge | Trigger |
|-------|---------|
| 🦉 **Night Owl** | Activity logged after 9pm local time on 5+ different days |
| 🌅 **Early Bird** | Activity logged before 7am local time on 5+ different days |
| 📝 **All-Rounder** | All 4 weekly wellness check-ins completed |

### What to build

**1. Supabase migration** — `supabase/migration-badges.sql`

Two new tables:
```sql
create table badges (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,          -- e.g. 'bronze', 'silver', 'on_fire'
  name text not null,                 -- display name e.g. 'Bronze'
  icon text not null,                 -- emoji
  description text not null,          -- "Log your first activity"
  category text not null,             -- 'milestone' | 'streak' | 'social' | 'hidden'
  trigger_type text not null,         -- 'points' | 'streak_days' | 'checkins' | 'manual'
  trigger_value integer               -- threshold (null for manual)
);

create table user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  badge_id uuid not null references badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_id)
);
```

Plus an `award_badges()` Postgres function that runs after each insert on `activity_entries` or `wellness_checkins`. It checks all badge conditions for that user and inserts any newly-earned ones.

**2. Badge display component** — `components/BadgeDisplay.tsx`

- Compact badge row on Dashboard (earned badges only, horizontal scroll)
- Full badge grid on a new `/badges` page (all 12, earned ones highlighted, unearned ones greyed out with "???" tooltip for hidden)
- Badge icons next to participant names on the Leaderboard (max 3 shown + "+N more" pill)

**3. Leaderboard badge column** — Update `Leaderboard.tsx`

Fetches `user_badges` via a new `profile_badges` view (pre-joined to avoid N+1). Shows earned badge icons beside each name.

**4. Dashboard badge section** — Update `Dashboard.tsx`

New section between the points summary and the activity form showing earned badges. Uses the existing `activity_entries`/`wellness_checkins` subscriptions so it's reactive — a badge pops in the moment they earn it.

**5. Notification toast** — `lib/badge-utils.ts`

When `award_badges()` returns newly-earned badge IDs, show a brief confetti-triggered toast: "🏆 Badge unlocked: Champion!" Integrates with the existing `useCelebration` milestone system.

### Files changed

| File | Change |
|------|--------|
| `supabase/migration-badges.sql` | New — badges + user_badges tables, award_badges() function, badge data seed |
| `components/BadgeDisplay.tsx` | New — badge grid/row component |
| `lib/badge-utils.ts` | New — check + display logic, badge definitions constants |
| `supabase/schema.sql` | Append — badge-related RLS policies (select all, insert from function only) |
| `components/Dashboard.tsx` | +badge section between points and activity form |
| `components/Leaderboard.tsx` | +badge icons next to names |
| `app/badges/page.tsx` | New — full badge gallery page |
| `lib/data.ts` | +badge fetching functions |

### Experience impact

- **Day 1:** Everyone gets Bronze 🥉 instantly — hooks them into the system
- **Week 1-2:** Most earn Silver 🥈 — feels like real progress
- **Mid-challenge:** Streak badges start appearing — creates healthy competition
- **End:** Champion 🏆 becomes the status symbol. Overachiever ⭐ for the dedicated
- **After:** The badge gallery page gives late-challenge motivation — "I only need 2 more!"

The cost is one migration file, one new component, and small patches to 3 existing files. No new backend infrastructure, no new auth flows.

---

## To merge

```bash
git checkout -b v1.4
# apply changes
git add .
git commit -m "feat: badge/achievement system with 12 earnable badges"
git push origin v1.4
```

Then Patrick can browse the branch on GitHub, cherry-pick individual pieces, or merge the whole thing. The badge migration is standalone — can be run independently.
