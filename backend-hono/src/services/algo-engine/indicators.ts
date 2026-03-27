// [claude-code 2026-03-26] S1-T1: Algo engine foundation — stateful indicators (EMA, RSI, ATR)
// Ported from QuantConnect FortyFortyClub/main.py — exact calculation methods preserved

import type { Bar } from './types.js';

/**
 * Exponential Moving Average.
 * Standard EMA: multiplier = 2 / (period + 1)
 */
export class EMA {
  private period: number;
  private multiplier: number;
  private _value: number;
  private _count: number;
  private _sum: number;

  constructor(period: number) {
    if (period < 1) throw new Error('EMA period must be >= 1');
    this.period = period;
    this.multiplier = 2 / (period + 1);
    this._value = 0;
    this._count = 0;
    this._sum = 0;
  }

  /** Update with a new bar. Returns the current EMA value. */
  update(bar: Bar): number {
    this._count++;

    if (this._count <= this.period) {
      // Seed phase: accumulate SMA
      this._sum += bar.close;
      if (this._count === this.period) {
        this._value = this._sum / this.period;
      }
    } else {
      // EMA calculation
      this._value = (bar.close - this._value) * this.multiplier + this._value;
    }

    return this._value;
  }

  get value(): number {
    return this._value;
  }

  get isReady(): boolean {
    return this._count >= this.period;
  }
}

/**
 * Relative Strength Index using Wilder's smoothing method.
 * Wilder's smoothing: avgGain = (prevAvgGain * (period - 1) + currentGain) / period
 */
export class RSI {
  private period: number;
  private _avgGain: number;
  private _avgLoss: number;
  private _prevClose: number | null;
  private _count: number;
  private _value: number;
  private _gains: number[];
  private _losses: number[];

  constructor(period: number) {
    if (period < 1) throw new Error('RSI period must be >= 1');
    this.period = period;
    this._avgGain = 0;
    this._avgLoss = 0;
    this._prevClose = null;
    this._count = 0;
    this._value = 50; // neutral default
    this._gains = [];
    this._losses = [];
  }

  /** Update with a new bar. Returns the current RSI value. */
  update(bar: Bar): number {
    if (this._prevClose === null) {
      this._prevClose = bar.close;
      return this._value;
    }

    const change = bar.close - this._prevClose;
    this._prevClose = bar.close;

    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    this._count++;

    if (this._count <= this.period) {
      // Seed phase: collect gains and losses
      this._gains.push(gain);
      this._losses.push(loss);

      if (this._count === this.period) {
        // Initial average
        this._avgGain = this._gains.reduce((a, b) => a + b, 0) / this.period;
        this._avgLoss = this._losses.reduce((a, b) => a + b, 0) / this.period;

        if (this._avgLoss === 0) {
          this._value = 100;
        } else {
          const rs = this._avgGain / this._avgLoss;
          this._value = 100 - 100 / (1 + rs);
        }
        // Free seed arrays
        this._gains = [];
        this._losses = [];
      }
    } else {
      // Wilder's smoothing
      this._avgGain = (this._avgGain * (this.period - 1) + gain) / this.period;
      this._avgLoss = (this._avgLoss * (this.period - 1) + loss) / this.period;

      if (this._avgLoss === 0) {
        this._value = 100;
      } else {
        const rs = this._avgGain / this._avgLoss;
        this._value = 100 - 100 / (1 + rs);
      }
    }

    return this._value;
  }

  get value(): number {
    return this._value;
  }

  get isReady(): boolean {
    // Need period + 1 bars (period changes + 1 initial)
    return this._count >= this.period;
  }
}

/**
 * Average True Range.
 * True range = max(high - low, |high - prevClose|, |low - prevClose|)
 * Averaged using Wilder's smoothing (same as RSI).
 */
export class ATR {
  private period: number;
  private _prevClose: number | null;
  private _value: number;
  private _count: number;
  private _trueRanges: number[];

  constructor(period: number) {
    if (period < 1) throw new Error('ATR period must be >= 1');
    this.period = period;
    this._prevClose = null;
    this._value = 0;
    this._count = 0;
    this._trueRanges = [];
  }

  /** Update with a new bar. Returns the current ATR value. */
  update(bar: Bar): number {
    let tr: number;

    if (this._prevClose === null) {
      // First bar: true range is just high - low
      tr = bar.high - bar.low;
    } else {
      // True range: max of three values
      tr = Math.max(
        bar.high - bar.low,
        Math.abs(bar.high - this._prevClose),
        Math.abs(bar.low - this._prevClose)
      );
    }

    this._prevClose = bar.close;
    this._count++;

    if (this._count <= this.period) {
      // Seed phase: collect true ranges
      this._trueRanges.push(tr);

      if (this._count === this.period) {
        // Initial ATR = simple average
        this._value = this._trueRanges.reduce((a, b) => a + b, 0) / this.period;
        this._trueRanges = [];
      }
    } else {
      // Wilder's smoothing
      this._value = (this._value * (this.period - 1) + tr) / this.period;
    }

    return this._value;
  }

  get value(): number {
    return this._value;
  }

  get isReady(): boolean {
    return this._count >= this.period;
  }
}
