const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function relativeTime(timestamp: string, now = new Date()): string {
  const createdAt = new Date(timestamp).getTime();
  if (!Number.isFinite(createdAt)) return "just now";

  const elapsed = Math.max(0, now.getTime() - createdAt);
  if (elapsed < MINUTE_MS) return "just now";
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}m ago`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h ago`;
  if (elapsed < 2 * DAY_MS) return "yesterday";
  return `${Math.floor(elapsed / DAY_MS)}d ago`;
}
