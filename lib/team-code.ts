export function teamJoinCodeFromUuid(uuid: string): string {
  const code = uuid.replaceAll("-", "").slice(0, 6).toUpperCase();
  if (code.length !== 6) {
    throw new Error("A team join code requires at least six characters.");
  }
  return code;
}
