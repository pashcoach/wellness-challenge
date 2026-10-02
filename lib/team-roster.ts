import { displayName } from "./data";

export interface TeamRosterProfile {
  id: string;
  full_name: string;
  username: string | null;
}

export interface TeamRosterMember {
  id: string;
  display_name: string;
  is_current_user: boolean;
}

export function prepareTeamRoster(
  profiles: TeamRosterProfile[],
  currentUserId: string
): TeamRosterMember[] {
  return profiles
    .map((profile) => ({
      id: profile.id,
      display_name: displayName(profile),
      is_current_user: profile.id === currentUserId,
    }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
}
