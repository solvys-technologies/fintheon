// [claude-code 2026-04-20] S21-T5: Per-user feature override lookup service.
// Resolution order for getFlag(name, userId?):
//   1. user_feature_overrides row (user-specific)  ← added in this sprint
//   2. env var (ENABLE_*)
//   3. FINTHEON_FEATURE_FLAGS JSON blob
//   4. code default in feature-flag-service registry
// The first three were already wired; this module supplies #1.

import { getSupabaseClient } from "../config/supabase.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("UserFeatureOverrides");

interface OverrideRow {
  enabled: boolean;
  config: Record<string, unknown>;
}

// 30s cache per (userId, feature) pair so the hot path doesn't hit Supabase
// every time an agent system prompt is composed.
const cache = new Map<string, { row: OverrideRow | null; expiresAt: number }>();
const TTL_MS = 30_000;

function cacheKey(userId: string, feature: string): string {
  return `${userId}::${feature}`;
}

export async function getUserOverride(
  userId: string,
  feature: string,
): Promise<OverrideRow | null> {
  const key = cacheKey(userId, feature);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.row;

  const sb = getSupabaseClient();
  if (!sb) {
    cache.set(key, { row: null, expiresAt: Date.now() + TTL_MS });
    return null;
  }

  const { data, error } = await sb
    .from("user_feature_overrides")
    .select("enabled, config")
    .eq("user_id", userId)
    .eq("feature", feature)
    .maybeSingle();

  if (error) {
    log.warn("lookup failed", { error: error.message, userId, feature });
    cache.set(key, { row: null, expiresAt: Date.now() + TTL_MS });
    return null;
  }

  const row: OverrideRow | null = data
    ? {
        enabled: !!data.enabled,
        config: (data.config as Record<string, unknown>) ?? {},
      }
    : null;

  cache.set(key, { row, expiresAt: Date.now() + TTL_MS });
  return row;
}

export function invalidateOverrideCache(userId?: string): void {
  if (!userId) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(`${userId}::`)) cache.delete(key);
  }
}

export async function setUserOverride(
  userId: string,
  feature: string,
  enabled: boolean,
  config: Record<string, unknown> = {},
  grantedBy?: string,
): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { error } = await sb.from("user_feature_overrides").upsert({
    user_id: userId,
    feature,
    enabled,
    config,
    granted_by: grantedBy ?? null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    log.error("set override failed", { error: error.message });
    return false;
  }
  invalidateOverrideCache(userId);
  return true;
}

export async function listUserOverrides(userId: string) {
  const sb = getSupabaseClient();
  if (!sb) return [];
  const { data } = await sb
    .from("user_feature_overrides")
    .select("feature, enabled, config, granted_at, updated_at")
    .eq("user_id", userId);
  return data ?? [];
}
