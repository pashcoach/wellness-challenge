export interface TeamMembershipRefreshResult {
  data: { team_id: string | null } | null;
  error: unknown | null;
}

export function hasConfirmedTeamMembership(result: TeamMembershipRefreshResult): boolean {
  return result.error === null && Boolean(result.data?.team_id);
}

/** Normalize a pasted team code: trim, drop spaces/dashes, uppercase. */
export function normalizeTeamCode(raw: string): string {
  return raw.replace(/[^a-z0-9]/gi, "").toUpperCase();
}
