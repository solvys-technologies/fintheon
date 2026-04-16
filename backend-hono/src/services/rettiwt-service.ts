// [claude-code 2026-04-12] Rettiwt service — per-user API key pool with rotation + guest fallback for timelines
// Replaces single-token singleton. Keys loaded from user_settings.rettiwt_api_keys in Supabase.

import { Rettiwt } from "rettiwt-api";
import { createLogger } from "../lib/logger.js";
import { getSupabaseClient, isSupabaseConfigured } from "../config/supabase.js";

const log = createLogger("RettiwtService");

export interface RettiwtSearchResult {
  id: string;
  text: string;
  author: string;
  publishedDate: string;
  url: string;
}

// ── Key Pool ──────────────────────────────────────────────────────────────────

interface PooledKey {
  apiKey: string;
  userId: string;
  client: Rettiwt;
  cooldownUntil: number; // epoch ms — 0 = available
  failures: number;
}

const keyPool: PooledKey[] = [];
let rotationIndex = 0;
let lastKeyLoadMs = 0;
const KEY_RELOAD_INTERVAL = 5 * 60_000; // reload from DB every 5 min
const COOLDOWN_MS = 90_000; // 90s cooldown per key on 429
const MAX_FAILURES = 5; // disable key after 5 consecutive failures

/** Load API keys from all users in Supabase */
async function loadKeysFromDB(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const now = Date.now();
  if (now - lastKeyLoadMs < KEY_RELOAD_INTERVAL && keyPool.length > 0) return;

  try {
    const sb = getSupabaseClient()!;
    const { data, error } = await sb
      .from("user_settings")
      .select("user_id, rettiwt_api_keys")
      .not("rettiwt_api_keys", "eq", "[]");

    if (error) {
      log.warn("Failed to load Rettiwt keys from DB", { error: error.message });
      return;
    }

    if (!data || data.length === 0) {
      // Also check env fallback
      const envKey = process.env.RETTIWT_AUTH_TOKEN;
      if (envKey && envKey.length > 10) {
        const existing = keyPool.find((k) => k.apiKey === envKey);
        if (!existing) {
          keyPool.push({
            apiKey: envKey,
            userId: "env-fallback",
            client: new Rettiwt({ apiKey: envKey, timeout: 8000 }),
            cooldownUntil: 0,
            failures: 0,
          });
          log.info("Loaded 1 Rettiwt key from RETTIWT_AUTH_TOKEN env");
        }
      }
      lastKeyLoadMs = now;
      return;
    }

    // Merge new keys into pool without disrupting existing cooldowns
    const seenKeys = new Set<string>();
    for (const row of data) {
      const keys: string[] = Array.isArray(row.rettiwt_api_keys)
        ? row.rettiwt_api_keys
        : [];
      for (const apiKey of keys) {
        if (!apiKey || apiKey.length < 10) continue;
        seenKeys.add(apiKey);
        const existing = keyPool.find((k) => k.apiKey === apiKey);
        if (!existing) {
          keyPool.push({
            apiKey,
            userId: row.user_id,
            client: new Rettiwt({ apiKey, timeout: 8000 }),
            cooldownUntil: 0,
            failures: 0,
          });
        }
      }
    }

    // Also load env fallback
    const envKey = process.env.RETTIWT_AUTH_TOKEN;
    if (envKey && envKey.length > 10 && !seenKeys.has(envKey)) {
      const existing = keyPool.find((k) => k.apiKey === envKey);
      if (!existing) {
        keyPool.push({
          apiKey: envKey,
          userId: "env-fallback",
          client: new Rettiwt({ apiKey: envKey, timeout: 8000 }),
          cooldownUntil: 0,
          failures: 0,
        });
      }
    }

    // Remove keys no longer in DB (except env fallback)
    for (let i = keyPool.length - 1; i >= 0; i--) {
      if (
        keyPool[i].userId !== "env-fallback" &&
        !seenKeys.has(keyPool[i].apiKey)
      ) {
        keyPool.splice(i, 1);
      }
    }

    lastKeyLoadMs = now;
    log.info(
      `Rettiwt key pool: ${keyPool.length} keys loaded from ${data.length} users`,
    );
  } catch (err) {
    log.warn("Failed to load Rettiwt keys", { error: String(err) });
  }
}

/** Get next available authenticated client via round-robin */
function getNextAuthClient(): PooledKey | null {
  const now = Date.now();
  const available = keyPool.filter(
    (k) => k.cooldownUntil < now && k.failures < MAX_FAILURES,
  );
  if (available.length === 0) return null;
  rotationIndex = rotationIndex % available.length;
  const picked = available[rotationIndex];
  rotationIndex = (rotationIndex + 1) % available.length;
  return picked;
}

/** Mark a key as rate-limited */
function markKeyCooldown(key: PooledKey): void {
  key.cooldownUntil = Date.now() + COOLDOWN_MS;
  key.failures++;
  log.warn(
    `Rettiwt key cooldown: user=${key.userId}, failures=${key.failures}, cooldown=${COOLDOWN_MS / 1000}s`,
  );
}

/** Mark a key as successful */
function markKeySuccess(key: PooledKey): void {
  key.failures = 0;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns true if at least one authenticated key exists (even if on cooldown) */
export function isRettiwtAvailable(): boolean {
  return keyPool.length > 0;
}

/** Returns true if at least one authenticated key exists for search */
export function hasAuthenticatedKeys(): boolean {
  const now = Date.now();
  return keyPool.some(
    (k) => k.cooldownUntil < now && k.failures < MAX_FAILURES,
  );
}

/** Initialize the key pool — call at boot */
export async function initRettiwtPool(): Promise<void> {
  await loadKeysFromDB();
  log.info(
    `Rettiwt pool initialized: ${keyPool.length} authenticated keys, guest client ready for timelines`,
  );
}

/**
 * Search tweets — requires authenticated key.
 * Rotates through user keys, cools down on 429.
 */
export async function rettiwtSearch(
  query: string,
  opts?: { count?: number },
): Promise<RettiwtSearchResult[]> {
  await loadKeysFromDB();

  const key = getNextAuthClient();
  if (!key) {
    log.warn("No authenticated Rettiwt keys available for search");
    return [];
  }

  try {
    const response = await key.client.tweet.search(
      { includeWords: query.split(" ").slice(0, 10) },
      opts?.count ?? 10,
    );

    if (!response?.list) {
      markKeyCooldown(key);
      return [];
    }

    markKeySuccess(key);
    return response.list.map((tweet) => ({
      id: tweet.id ?? "",
      text: tweet.fullText ?? "",
      author: tweet.tweetBy?.userName ?? "unknown",
      publishedDate: tweet.createdAt
        ? new Date(tweet.createdAt).toISOString()
        : new Date().toISOString(),
      url: `https://x.com/${tweet.tweetBy?.userName ?? "i"}/status/${tweet.id}`,
    }));
  } catch (err) {
    const msg = String(err);
    if (
      msg.includes("429") ||
      msg.includes("rate") ||
      msg.includes("Not authorized")
    ) {
      markKeyCooldown(key);
    }
    log.warn(`Rettiwt search failed (key=${key.userId})`, { error: msg });
    return [];
  }
}

/**
 * Fetch user timeline — requires authenticated key.
 * Guest auth returns stale/cached data, not live timelines.
 */
export async function rettiwtUserTimeline(
  username: string,
  opts?: { count?: number },
): Promise<RettiwtSearchResult[]> {
  await loadKeysFromDB();
  const key = getNextAuthClient();
  if (!key) return [];

  try {
    const user = await key.client.user.details(username);
    if (!user?.id) return [];

    const response = await key.client.user.timeline(user.id, opts?.count ?? 10);
    if (!response?.list) return [];

    markKeySuccess(key);
    return response.list.map((tweet) => ({
      id: tweet.id ?? "",
      text: tweet.fullText ?? "",
      author: username,
      publishedDate: tweet.createdAt
        ? new Date(tweet.createdAt).toISOString()
        : new Date().toISOString(),
      url: `https://x.com/${username}/status/${tweet.id}`,
    }));
  } catch (err) {
    const msg = String(err);
    if (msg.includes("429") || msg.includes("rate")) {
      markKeyCooldown(key);
    }
    log.warn(`Rettiwt timeline failed for @${username} (key=${key.userId})`, {
      error: msg,
    });
    return [];
  }
}

/**
 * Force-refresh the key pool: reload from DB, reset ALL cooldowns and failure counts.
 * Called on app startup to ensure keys are fresh and not stuck in cooldown loops.
 * [claude-code 2026-04-16]
 */
export async function forceRefreshPool(): Promise<{
  totalKeys: number;
  resetCount: number;
}> {
  // Reset cooldowns and failures on existing keys
  let resetCount = 0;
  for (const key of keyPool) {
    if (key.cooldownUntil > 0 || key.failures > 0) {
      key.cooldownUntil = 0;
      key.failures = 0;
      resetCount++;
    }
  }

  // Force DB reload by clearing the debounce timer
  lastKeyLoadMs = 0;
  await loadKeysFromDB();

  log.info(
    `Force-refreshed Rettiwt pool: ${keyPool.length} keys, ${resetCount} cooldowns reset`,
  );
  return { totalKeys: keyPool.length, resetCount };
}

/** Get pool status for diagnostics */
export function getPoolStatus(): {
  totalKeys: number;
  availableKeys: number;
  cooldownKeys: number;
  disabledKeys: number;
} {
  const now = Date.now();
  const available = keyPool.filter(
    (k) => k.cooldownUntil < now && k.failures < MAX_FAILURES,
  );
  const cooldown = keyPool.filter(
    (k) => k.cooldownUntil >= now && k.failures < MAX_FAILURES,
  );
  const disabled = keyPool.filter((k) => k.failures >= MAX_FAILURES);
  return {
    totalKeys: keyPool.length,
    availableKeys: available.length,
    cooldownKeys: cooldown.length,
    disabledKeys: disabled.length,
  };
}
