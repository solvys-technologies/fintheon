// [claude-code 2026-05-13] Lockout — in-memory trading lockout with countdown
import type { LockoutState } from "../types/lockout.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("lockout");

interface LockoutEntry {
  locked: boolean;
  until: number | null; // epoch ms
  reason?: string;
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
  };
}

export function setLockout(
  userId: string,
  locked: boolean,
  durationMs?: number,
): LockoutState {
  if (!locked) {
    store.delete(userId);
    log.info("Lockout cleared", { userId });
    return { locked: false, until: null, remaining: null };
  }
  const ms = durationMs ?? DEFAULT_DURATION_MS;
  const until = Date.now() + ms;
  store.set(userId, { locked: true, until, reason: "manual" });
  log.info("Lockout set", { userId, durationMs: ms });
  return {
    locked: true,
    until: new Date(until).toISOString(),
    remaining: Math.round(ms / 1000),
    reason: "manual",
  };
}

/** Called by desk-context preflight to inject lockout state into agent context */
export function getLockoutSummary(userId?: string): string {
  const state = getLockout(userId ?? "default");
  if (!state.locked) return "Trading is not locked.";
  const min = state.remaining ? Math.round(state.remaining / 60) : 0;
  return `Trading is LOCKED for another ${min} minute${min === 1 ? "" : "s"}. No trade actions should be suggested.`;
}
