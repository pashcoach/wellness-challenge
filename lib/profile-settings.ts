import { displayName } from "./data";

export const USERNAME_MAX = 20;

export type UsernameResult =
  | { ok: true; username: string | null }
  | { ok: false; error: string };

export function normalizeUsername(value: string): UsernameResult {
  const username = value.trim();
  if (username.length > USERNAME_MAX) {
    return { ok: false, error: `Usernames can be up to ${USERNAME_MAX} characters.` };
  }
  return { ok: true, username: username || null };
}

export function publicNameAfterUsernameChange(fullName: string, username: string): string {
  return displayName({ full_name: fullName, username: username.trim() || null });
}
