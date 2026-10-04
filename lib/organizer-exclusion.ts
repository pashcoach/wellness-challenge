/** Drop accounts flagged as excluded from standings (e.g. the admin-only organizer account). */
export function excludeFromStandings<T extends { exclude_from_standings?: boolean | null }>(rows: T[]): T[] {
  return rows.filter((row) => row.exclude_from_standings !== true);
}
