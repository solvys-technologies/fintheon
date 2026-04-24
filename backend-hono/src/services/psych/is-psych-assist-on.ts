// [claude-code 2026-04-23] S31-T6 — single source of truth for PsychAssist gating.
// When OFF the platform must be silent: zero scoring, zero counters, zero rows
// generated. Every psych service calls this before doing any work.

import { getSupabaseClient } from "../../config/supabase.js";

const cache = new Map<string, { value: boolean; expiresAt: number }>();
const TTL_MS = 30_000;

export async function isPsychAssistOn(userId: string): Promise<boolean> {
  if (!userId) return false;
  const now = Date.now();
  const hit = cache.get(userId);
  if (hit && hit.expiresAt > now) return hit.value;

  const sb = getSupabaseClient();
  if (!sb) {
    cache.set(userId, { value: false, expiresAt: now + TTL_MS });
    return false;
  }

  try {
    const { data } = await sb
      .from("user_preferences")
      .select("prefs")
      .eq("user_id", userId)
      .maybeSingle();

    const prefs = (data?.prefs ?? {}) as Record<string, unknown>;
    const enabled = prefs.psychAssistEnabled === true;
    cache.set(userId, { value: enabled, expiresAt: now + TTL_MS });
    return enabled;
  } catch {
    cache.set(userId, { value: false, expiresAt: now + TTL_MS });
    return false;
  }
}

export function invalidatePsychAssistCache(userId?: string): void {
  if (userId) cache.delete(userId);
  else cache.clear();
}

export async function listPsychAssistEnabledUsers(): Promise<string[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  try {
    const { data } = await sb.from("user_preferences").select("user_id, prefs");
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (r) =>
          r?.prefs &&
          typeof r.prefs === "object" &&
          (r.prefs as Record<string, unknown>).psychAssistEnabled === true,
      )
      .map((r) => r.user_id as string);
  } catch {
    return [];
  }
}
