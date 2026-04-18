// [claude-code 2026-04-11] Per-user RiskFlow killswitch + round-robin polling owner registry
// [claude-code 2026-04-18] S25-T2: lifted from cosmetic owner tracker to functional — added
// lastSuccessAt/totalContributions so Team Card can show "Polled Nm ago" per user.

export interface UserPollingEntry {
  killed: boolean;
  lastSeen: number;
  lastPollAt: number | null;
  lastSuccessAt: number | null;
  totalContributions: number;
}

const registry = new Map<string, UserPollingEntry>();

export const BACKEND_SENTINEL_USER_ID = "backend";

const STALE_THRESHOLD_MS = 10 * 60_000; // 10 min
const ACTIVE_THRESHOLD_MS = 5 * 60_000; // 5 min

// ── Round-Robin Owner Tracking ─────────────────────────────────────────────

let currentOwnerId: string | null = null;
let ownerQueue: string[] = [];

export function getCurrentPollingOwner(): string | null {
  return currentOwnerId;
}

export function setPollingOwner(userId: string): void {
  currentOwnerId = userId;
}

export function getOwnerQueue(): string[] {
  return [...ownerQueue];
}

/** Rebuild the owner queue from active (non-killed, non-stale) users */
function rebuildOwnerQueue(): void {
  ownerQueue = getActivePollingUsers();
}

/**
 * Advance polling owner to the next active user in the queue.
 * Returns the new owner ID, or null if no active users remain (scrape-only mode).
 */
export function advancePollingOwner(): string | null {
  rebuildOwnerQueue();

  if (ownerQueue.length === 0) {
    currentOwnerId = null;
    return null;
  }

  if (!currentOwnerId || !ownerQueue.includes(currentOwnerId)) {
    currentOwnerId = ownerQueue[0];
    return currentOwnerId;
  }

  const currentIdx = ownerQueue.indexOf(currentOwnerId);
  const nextIdx = (currentIdx + 1) % ownerQueue.length;
  currentOwnerId = ownerQueue[nextIdx];
  return currentOwnerId;
}

// ── Per-User State ─────────────────────────────────────────────────────────

export function setUserPollingState(userId: string, killed: boolean): void {
  const existing = registry.get(userId);
  registry.set(userId, {
    killed,
    lastSeen: Date.now(),
    lastPollAt: existing?.lastPollAt ?? null,
    lastSuccessAt: existing?.lastSuccessAt ?? null,
    totalContributions: existing?.totalContributions ?? 0,
  });

  // If user killed their feed and they were the owner, advance to next
  if (killed && currentOwnerId === userId) {
    advancePollingOwner();
  }

  // If user resumed and there's no owner, claim ownership
  if (!killed && currentOwnerId === null) {
    currentOwnerId = userId;
  }

  rebuildOwnerQueue();
}

/**
 * Attribute a successful poll cycle (fetched AND scored/ingested) to a user.
 * Creates a sentinel entry for "backend" when no active user is online.
 */
export function recordUserPollSuccess(userId: string | null): void {
  const id = userId ?? BACKEND_SENTINEL_USER_ID;
  const now = Date.now();
  const existing = registry.get(id);
  if (existing) {
    existing.lastPollAt = now;
    existing.lastSuccessAt = now;
    existing.totalContributions++;
    existing.lastSeen = now;
  } else {
    registry.set(id, {
      killed: false,
      lastSeen: now,
      lastPollAt: now,
      lastSuccessAt: now,
      totalContributions: 1,
    });
  }
}

/** Attribute a poll attempt (whether it produced items or not) to a user. */
export function recordUserPollAttempt(userId: string | null): void {
  const id = userId ?? BACKEND_SENTINEL_USER_ID;
  const now = Date.now();
  const existing = registry.get(id);
  if (existing) {
    existing.lastPollAt = now;
    existing.lastSeen = now;
  } else {
    registry.set(id, {
      killed: false,
      lastSeen: now,
      lastPollAt: now,
      lastSuccessAt: null,
      totalContributions: 0,
    });
  }
}

export interface UserPollStats {
  lastPollAt: string | null;
  lastSuccessAt: string | null;
  totalContributions: number;
  currentlyOwner: boolean;
}

/** Snapshot every user's polling stats — for /api/riskflow/sources response. */
export function getAllUserPollStats(): Record<string, UserPollStats> {
  const out: Record<string, UserPollStats> = {};
  for (const [userId, entry] of registry.entries()) {
    out[userId] = {
      lastPollAt: entry.lastPollAt
        ? new Date(entry.lastPollAt).toISOString()
        : null,
      lastSuccessAt: entry.lastSuccessAt
        ? new Date(entry.lastSuccessAt).toISOString()
        : null,
      totalContributions: entry.totalContributions,
      currentlyOwner: userId === currentOwnerId,
    };
  }
  return out;
}

/** Get a single user's stats (for Doctor endpoint response). */
export function getUserPollStats(userId: string): UserPollStats | null {
  const entry = registry.get(userId);
  if (!entry) return null;
  return {
    lastPollAt: entry.lastPollAt
      ? new Date(entry.lastPollAt).toISOString()
      : null,
    lastSuccessAt: entry.lastSuccessAt
      ? new Date(entry.lastSuccessAt).toISOString()
      : null,
    totalContributions: entry.totalContributions,
    currentlyOwner: userId === currentOwnerId,
  };
}

export function getUserPollingState(userId: string): boolean {
  return registry.get(userId)?.killed ?? false;
}

export function getActivePollingUsers(): string[] {
  const now = Date.now();
  return Array.from(registry.entries())
    .filter(([, e]) => !e.killed && now - e.lastSeen < ACTIVE_THRESHOLD_MS)
    .map(([id]) => id);
}

export function areAllUsersKilled(): boolean {
  if (registry.size === 0) return false;
  return Array.from(registry.values()).every((e) => e.killed);
}

export function cleanupStaleUsers(): void {
  const now = Date.now();
  let ownerWentStale = false;
  for (const [id, entry] of registry.entries()) {
    if (now - entry.lastSeen > STALE_THRESHOLD_MS) {
      if (id === currentOwnerId) ownerWentStale = true;
      registry.delete(id);
    }
  }
  rebuildOwnerQueue();
  if (ownerWentStale) advancePollingOwner();
}
