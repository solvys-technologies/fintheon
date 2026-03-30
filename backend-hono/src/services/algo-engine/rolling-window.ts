// [claude-code 2026-03-26] S1-T1: Algo engine foundation — generic typed rolling window
// Ported from QuantConnect's Python RollingWindow

/**
 * Fixed-capacity sliding window that keeps the N most recent items.
 * Index 0 = most recent, index (length - 1) = oldest.
 */
export class RollingWindow<T> {
  private items: T[];
  private capacity: number;
  private count: number;

  constructor(capacity: number) {
    if (capacity < 1) throw new Error('RollingWindow capacity must be >= 1');
    this.capacity = capacity;
    this.items = new Array<T>(capacity);
    this.count = 0;
  }

  /** Add an item to the front (most recent position). Drops oldest if full. */
  add(item: T): void {
    // Shift everything right by one
    for (let i = Math.min(this.count, this.capacity - 1); i > 0; i--) {
      this.items[i] = this.items[i - 1];
    }
    this.items[0] = item;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /** Get item by index. 0 = most recent. */
  get(index: number): T {
    if (index < 0 || index >= this.count) {
      throw new RangeError(`Index ${index} out of range [0, ${this.count - 1}]`);
    }
    return this.items[index];
  }

  /** True when the window has been filled to capacity at least once. */
  get isReady(): boolean {
    return this.count >= this.capacity;
  }

  /** The most recently added item. */
  get mostRecent(): T {
    if (this.count === 0) throw new Error('RollingWindow is empty');
    return this.items[0];
  }

  /** Number of items currently in the window. */
  get length(): number {
    return this.count;
  }

  /** Return items as array, most recent first. */
  toArray(): T[] {
    return this.items.slice(0, this.count);
  }

  /** Clear all items. */
  reset(): void {
    this.count = 0;
  }
}
