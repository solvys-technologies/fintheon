export function dbUserId(userId: string): string {
  if (userId === "local-user") return "00000000-0000-0000-0000-000000000001";
  return userId;
}
