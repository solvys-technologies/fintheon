// [claude-code 2026-04-11] Per-user RiskFlow killswitch + round-robin polling owner registry

interface UserPollingEntry {
  killed: boolean;
  lastSeen: number;
}

const registry = new Map<string, UserPollingEntry>();

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
  registry.set(userId, { killed, lastSeen: Date.now() });

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
