// [claude-code 2026-05-06] S60-T4: Idempotency store keyed by correlation_id to prevent duplicate event processing
const IDEMPOTENCY_TTL_MS = 86_400_000; // 24 hours

interface IdempotencyEntry {
  storedAt: number;
  response: unknown;
}

class IdempotencyStore {
  private store = new Map<string, IdempotencyEntry>();

  get(key: string): { isDuplicate: boolean; storedResponse?: unknown } {
    const entry = this.store.get(key);
    if (!entry) return { isDuplicate: false };
    if (Date.now() - entry.storedAt > IDEMPOTENCY_TTL_MS) {
      this.store.delete(key);
      return { isDuplicate: false };
    }
    return { isDuplicate: true, storedResponse: entry.response };
  }

  set(key: string, response: unknown): void {
    this.store.set(key, { storedAt: Date.now(), response });

    if (this.store.size % 1000 === 0) {
      const now = Date.now();
      for (const [k, v] of this.store) {
        if (now - v.storedAt > IDEMPOTENCY_TTL_MS) this.store.delete(k);
      }
    }
  }
}

export const idempotencyStore = new IdempotencyStore();
