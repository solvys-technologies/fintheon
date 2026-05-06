// [claude-code 2026-05-06] S60-T4: Replay cache with short TTL to prevent signature reuse attacks
const REPLAY_TTL_MS = 600_000; // 10 minutes

interface CacheEntry {
  storedAt: number;
}

class ReplayCache {
  private cache = new Map<string, CacheEntry>();

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() - entry.storedAt > REPLAY_TTL_MS) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  set(key: string): void {
    this.cache.set(key, { storedAt: Date.now() });

    // Periodic cleanup: remove all expired entries so the map doesn't grow unbounded
    if (this.cache.size % 1000 === 0) {
      const now = Date.now();
      for (const [k, v] of this.cache) {
        if (now - v.storedAt > REPLAY_TTL_MS) this.cache.delete(k);
      }
    }
  }
}

export const replayCache = new ReplayCache();
