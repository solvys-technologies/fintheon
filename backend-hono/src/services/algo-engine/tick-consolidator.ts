// [claude-code 2026-03-26] S1-T1: Algo engine foundation — tick-to-bar consolidator
// Ported from QuantConnect's TickConsolidator (1000 ticks for NQ, 500 for ES)

import type { Tick, Bar } from "./types.js";

/**
 * Aggregates raw ticks into bars of a fixed tick count.
 * Emits completed bars via the onBarComplete callback.
 */
export class TickConsolidator {
  private tickCount: number;
  private currentBar: Partial<Bar> | null;
  private currentTickCount: number;
  private onBarComplete: (bar: Bar) => void;

  /**
   * @param tickCount Number of ticks per bar (1000 for NQ, 500 for ES)
   * @param onBarComplete Callback fired when a bar completes
   */
  constructor(tickCount: number, onBarComplete: (bar: Bar) => void) {
    if (tickCount < 1)
      throw new Error("TickConsolidator tickCount must be >= 1");
    this.tickCount = tickCount;
    this.onBarComplete = onBarComplete;
    this.currentBar = null;
    this.currentTickCount = 0;
  }

  /** Feed a tick. Emits a bar via callback when tickCount is reached. */
  update(tick: Tick): void {
    if (this.currentBar === null) {
      // Start a new bar
      this.currentBar = {
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.volume,
        timestamp: tick.timestamp,
        duration: 0,
        tickCount: 0,
      };
      this.currentTickCount = 1;
    } else {
      // Update the current bar
      if (tick.price > (this.currentBar.high ?? -Infinity)) {
        this.currentBar.high = tick.price;
      }
      if (tick.price < (this.currentBar.low ?? Infinity)) {
        this.currentBar.low = tick.price;
      }
      this.currentBar.close = tick.price;
      this.currentBar.volume = (this.currentBar.volume ?? 0) + tick.volume;
      this.currentTickCount++;
    }

    // Check if bar is complete
    if (this.currentTickCount >= this.tickCount) {
      const bar: Bar = {
        open: this.currentBar.open!,
        high: this.currentBar.high!,
        low: this.currentBar.low!,
        close: this.currentBar.close!,
        volume: this.currentBar.volume!,
        timestamp: this.currentBar.timestamp!,
        duration: tick.timestamp - this.currentBar.timestamp!,
        tickCount: this.currentTickCount,
      };
      this.onBarComplete(bar);
      this.currentBar = null;
      this.currentTickCount = 0;
    }
  }

  /** The in-progress bar, if any. */
  get currentPartialBar(): Partial<Bar> | null {
    return this.currentBar;
  }

  /** Discard the current in-progress bar. */
  reset(): void {
    this.currentBar = null;
    this.currentTickCount = 0;
  }
}
