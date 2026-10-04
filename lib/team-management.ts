export interface TeamMembershipRefreshResult {
  data: { team_id: string | null } | null;
  error: unknown | null;
}

export function hasConfirmedTeamMembership(result: TeamMembershipRefreshResult): boolean {
  return result.error === null && Boolean(result.data?.team_id);
}
