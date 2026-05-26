import { getSupabaseClient } from "../../config/supabase.js";

export function getColiseumClient() {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");
  return sb;
}

export function isLocalDevActor(userId: string | null): boolean {
  if (!userId) return false;
  if (process.env.BYPASS_AUTH === "true") return true;
  return userId === "local-user";
}

export function isAuthedActor(
  userId: string | null | undefined,
): userId is string {
  return Boolean(userId && userId !== "anonymous" && userId !== "anon");
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}
