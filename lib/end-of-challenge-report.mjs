import { createClient } from '/Users/pash/Projects/wellness-challenge/node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Try to load .env.local from cwd if env vars are not already set
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  const envPath = resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const k = trimmed.slice(0, eq).trim();
        const v = trimmed.slice(eq + 1).trim();
        if (k && v && !process.env[k]) process.env[k] = v;
      }
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Missing Supabase env vars');

const supabase = createClient(url, key);

const [profiles, teams, activities, checkins, surveys] = await Promise.all([
  supabase.from("profiles").select("id, full_name, username, business_unit, located_at_crc, age_range, team_id, created_at"),
  supabase.from("teams").select("id, name, join_code, created_at"),
  supabase.from("activity_entries").select("user_id, activity, minutes, points, entry_date, week, created_at"),
  supabase.from("wellness_checkins").select("user_id, week, pillar, points, comment, entry_date, created_at"),
  supabase.from("survey_responses").select("user_id, feedback, created_at"),
]);

const pAll = (profiles.data ?? []);
const tAll = (teams.data ?? []);
const aAll = (activities.data ?? []);
const cAll = (checkins.data ?? []);
const sAll = (surveys.data ?? []);

// ---- Pre-registration period (Sept 18 – Oct 4) ----
const preregStart = "2026-09-18";
const challengeStart = "2026-10-05";
const preregProfiles = pAll.filter((p) => {
  const d = p.created_at?.slice(0, 10);
  return d && d >= preregStart && d < challengeStart;
});
const preregByDate = new Map();
for (const p of preregProfiles) {
  const d = p.created_at.slice(0, 10);
  preregByDate.set(d, (preregByDate.get(d) ?? 0) + 1);
}
const preregBUs = new Map();
for (const p of preregProfiles) preregBUs.set(p.business_unit, (preregBUs.get(p.business_unit) ?? 0) + 1);
const preregTeams = tAll.filter((t) => {
  const d = t.created_at?.slice(0, 10);
  return d && d >= preregStart && d < challengeStart;
});

// ---- Challenge period (Oct 5 – Oct 30 noon) ----
const challengeEnd = "2026-10-30";
const challengeActs = aAll.filter((a) => a.entry_date >= challengeStart && a.entry_date <= challengeEnd);
const challengeChecks = cAll.filter((c) => c.entry_date >= challengeStart && c.entry_date <= challengeEnd);
const challengeUsers = new Set();
for (const a of challengeActs) challengeUsers.add(a.user_id);
for (const c of challengeChecks) challengeUsers.add(c.user_id);
const challengeActive = pAll.filter((p) => challengeUsers.has(p.id));

// Weekly breakdown
const byWeek = [];
for (let w = 1; w <= 4; w++) {
  const weekUsers = new Set();
  for (const a of challengeActs) if (a.week === w) weekUsers.add(a.user_id);
  for (const c of challengeChecks) if (c.week === w) weekUsers.add(c.user_id);
  const pts = challengeActs.filter((a) => a.week === w).reduce((s, a) => s + a.points, 0) +
    challengeChecks.filter((c) => c.week === w).reduce((s, c) => s + c.points, 0);
  const min = challengeActs.filter((a) => a.week === w).reduce((s, a) => s + a.minutes, 0);
  const ck = challengeChecks.filter((c) => c.week === w).length;
  byWeek.push({ week: w, active: weekUsers.size, totalPoints: pts, totalMinutes: min, checkins: ck });
}

// Top activities
const freq = new Map();
for (const a of challengeActs) freq.set(a.activity, (freq.get(a.activity) ?? 0) + 1);
const topActs = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => ({ activity: k, count: v }));

// Team standings
const teamNames = new Map(tAll.map((t) => [t.id, t.name]));
const ptsByUser = new Map();
for (const a of challengeActs) ptsByUser.set(a.user_id, (ptsByUser.get(a.user_id) ?? 0) + a.points);
for (const c of challengeChecks) ptsByUser.set(c.user_id, (ptsByUser.get(c.user_id) ?? 0) + c.points);
const byTeam = new Map();
for (const p of pAll) {
  if (!p.team_id) continue;
  const arr = byTeam.get(p.team_id) ?? [];
  arr.push(ptsByUser.get(p.id) ?? 0);
  byTeam.set(p.team_id, arr);
}
const teamStandings = [...byTeam.entries()]
  .map(([id, pts]) => ({ name: teamNames.get(id) ?? "Team", members: pts.length, avg: pts.length > 0 ? Math.round(pts.reduce((s, v) => s + v, 0) / pts.length) : 0 }))
  .sort((a, b) => b.avg - a.avg);

// Demographics
const byBU = new Map();
const byAge = new Map();
let crcCount = 0;
for (const p of challengeActive) {
  byBU.set(p.business_unit, (byBU.get(p.business_unit) ?? 0) + 1);
  byAge.set(p.age_range, (byAge.get(p.age_range) ?? 0) + 1);
  if (p.located_at_crc) crcCount++;
}

// Team vs solo
const teamUserIds = new Set(pAll.filter((p) => p.team_id).map((p) => p.id));
const activeOnTeam = challengeActive.filter((p) => teamUserIds.has(p.id)).length;
const activeSolo = challengeActive.length - activeOnTeam;

// Registrations per day (challenge period)
const regByDate = new Map();
for (const p of pAll) {
  const d = p.created_at?.slice(0, 10);
  if (d && d >= challengeStart && d <= challengeEnd) regByDate.set(d, (regByDate.get(d) ?? 0) + 1);
}

// Feedback
const feedbackList = sAll.map((s) => {
  const p = pAll.find((x) => x.id === s.user_id);
  return { name: p ? p.full_name : "Unknown", feedback: s.feedback, created_at: s.created_at };
});

// Build output
const report = {
  preregistration: {
    totalRegistered: preregProfiles.length,
    registrationsByDate: Object.fromEntries(preregByDate),
    registrationsByBU: Object.fromEntries(preregBUs),
    teamsCreated: preregTeams.length,
  },
  challenge: {
    totalRegistered: pAll.length,
    activeParticipants: challengeActive.length,
    totalActivities: challengeActs.length,
    totalMinutes: challengeActs.reduce((s, a) => s + a.minutes, 0),
    totalPoints: challengeActs.reduce((s, a) => s + a.points, 0) + challengeChecks.reduce((s, c) => s + c.points, 0),
    totalCheckins: challengeChecks.length,
    weeklyBreakdown: byWeek,
    topActivities: topActs,
    teamStandings,
    byBU: Object.fromEntries(byBU),
    byAge: Object.fromEntries(byAge),
    crcParticipants: crcCount,
    nonCrcParticipants: challengeActive.length - crcCount,
    activeOnTeam,
    activeSolo,
    registrationsByDate: Object.fromEntries(regByDate),
    feedbackCount: feedbackList.length,
  },
};

console.log(JSON.stringify(report, null, 2));