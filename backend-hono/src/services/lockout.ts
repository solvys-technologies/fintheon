// [claude-code 2026-05-13] Lockout — in-memory trading lockout with countdown
// [claude-code 2026-05-13] S64 T3: Added Supabase persistence + auto-release scheduling
import type { LockoutState } from "../types/lockout.js";
import { createLogger } from "../lib/logger.js";
import { getSupabaseClient } from "../config/supabase.js";

const log = createLogger("lockout");

interface LockoutEntry {
  locked: boolean;
  until: number | null; // epoch ms
  reason?: string;
  autoReleaseAt?: string; // ISO timestamp
  scheduledBy?: "desk_plan" | "manual" | "system";
}

const store = new Map<string, LockoutEntry>();

const DEFAULT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export function getLockout(userId: string): LockoutState {
  const entry = store.get(userId);
  if (!entry || !entry.locked) {
    return { locked: false, until: null, remaining: null };
  }
  const now = Date.now();
  if (entry.until && entry.until <= now) {
    // Expired — clear and return unlocked
    store.delete(userId);
    log.info("Lockout auto-expired", { userId });
    return { locked: false, until: null, remaining: null };
  }
  const remaining = entry.until ? Math.round((entry.until - now) / 1000) : null;
  return {
    locked: true,
    until: entry.until ? new Date(entry.until).toISOString() : null,
    remaining: remaining! > 0 ? remaining : 0,
    reason: entry.reason,
    autoReleaseAt: entry.autoReleaseAt,
    scheduledBy: entry.scheduledBy,
  };
}

export function setLockout(
  userId: string,
  locked: boolean,
  durationMs?: number,
  override?: {
    reason?: string;
    scheduledBy?: "desk_plan" | "manual" | "system";
    autoReleaseAt?: string;
  },
): LockoutState {
  if (!locked) {
    const wasLocked = !!store.get(userId)?.locked;
    store.delete(userId);
    log.info("Lockout cleared", { userId });
    // Write audit log for unlock
    if (wasLocked) {
      const reason = override?.reason ?? "manual unlock";
      saveLockoutAudit(
        userId,
        "unlock",
        reason,
        override?.scheduledBy ?? "manual",
      ).catch(() => {});
    }
    return { locked: false, until: null, remaining: null };
  }
  const ms = durationMs ?? DEFAULT_DURATION_MS;
  const until = Date.now() + ms;
  store.set(userId, {
    locked: true,
    until,
    reason: override?.reason ?? "manual",
    autoReleaseAt: override?.autoReleaseAt,
    scheduledBy: override?.scheduledBy ?? "manual",
  });
  log.info("Lockout set", {
    userId,
    durationMs: ms,
    scheduledBy: override?.scheduledBy,
  });
  // Write audit log for lock
  const action = override?.scheduledBy === "desk_plan" ? "auto_lock" : "lock";
  saveLockoutAudit(
    userId,
    action,
    override?.reason ?? "manual lock",
    override?.scheduledBy ?? "manual",
  ).catch(() => {});

  return {
    locked: true,
    until: new Date(until).toISOString(),
    remaining: Math.round(ms / 1000),
    reason: override?.reason,
    autoReleaseAt: override?.autoReleaseAt,
    scheduledBy: override?.scheduledBy,
  };
}

/** Called by desk-context preflight to inject lockout state into agent context */
export function getLockoutSummary(userId?: string): string {
  const state = getLockout(userId ?? "default");
  if (!state.locked) return "Trading is not locked.";
  const min = state.remaining ? Math.round(state.remaining / 60) : 0;
  return `Trading is LOCKED for another ${min} minute${min === 1 ? "" : "s"}. No trade actions should be suggested.`;
}

/**
 * Schedule auto-release: computes releaseTime = windowStartTime - autoReleaseMinutes
 * and stores it in the lockout entry so the frontend can poll for automatic unlock.
 */
export function scheduleAutoRelease(
  userId: string,
  windowStartTime: string,
  autoReleaseMinutes: number = 15,
): string | null {
  const windowMs = new Date(windowStartTime).getTime();
  if (isNaN(windowMs)) {
    log.warn("Invalid windowStartTime for auto-release", {
      userId,
      windowStartTime,
    });
    return null;
  }
  const releaseTime = windowMs - autoReleaseMinutes * 60 * 1000;
  const releaseIso = new Date(releaseTime).toISOString();

  const existing = store.get(userId);
  if (existing && existing.locked) {
    existing.autoReleaseAt = releaseIso;
    store.set(userId, existing);
    log.info("Auto-release scheduled", { userId, releaseIso, windowStartTime });
  }
  return releaseIso;
}

/**
 * Load lockout settings from Supabase user_lockout_settings table.
 * Falls back to defaults silently if Supabase is not configured.
 */
export async function loadLockoutSettings(userId: string): Promise<{
  lockoutEnabled: boolean;
  autoLockFromDeskPlan: boolean;
  autoReleaseMinutes: number;
}> {
  const defaults = {
    lockoutEnabled: false,
    autoLockFromDeskPlan: true,
    autoReleaseMinutes: 15,
  };
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return defaults;
    const { data, error } = await supabase
      .from("user_lockout_settings")
      .select("lockout_enabled, auto_lock_from_desk_plan, auto_release_minutes")
      .eq("user_id", userId)
      .single();
    if (error || !data) return defaults;
    return {
      lockoutEnabled: data.lockout_enabled ?? false,
      autoLockFromDeskPlan: data.auto_lock_from_desk_plan ?? true,
      autoReleaseMinutes: data.auto_release_minutes ?? 15,
    };
  } catch {
    return defaults;
  }
}

/**
 * Save a lockout audit log entry to Supabase.
 * Silently fails if Supabase is not configured (in-memory mode).
 */
export async function saveLockoutAudit(
  userId: string,
  action: string,
  reason?: string,
  triggeredBy: string = "manual",
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.from("lockout_audit_log").insert({
      user_id: userId,
      action,
      reason: reason ?? null,
      triggered_by: triggeredBy,
    });
  } catch (err) {
    log.warn("Failed to write lockout audit log", {
      userId,
      action,
      error: String(err),
    });
  }
}
