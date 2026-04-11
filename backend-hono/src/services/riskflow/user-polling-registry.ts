// [claude-code 2026-04-10] Per-user X CLI killswitch registry

interface UserPollingEntry {
  killed: boolean;
  lastSeen: number;
}

const registry = new Map<string, UserPollingEntry>();

const STALE_THRESHOLD_MS = 10 * 60_000; // 10 min
const ACTIVE_THRESHOLD_MS = 5 * 60_000; // 5 min

export function setUserPollingState(userId: string, killed: boolean): void {
  registry.set(userId, { killed, lastSeen: Date.now() });
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
  for (const [id, entry] of registry.entries()) {
    if (now - entry.lastSeen > STALE_THRESHOLD_MS) {
      registry.delete(id);
    }
  }
}
