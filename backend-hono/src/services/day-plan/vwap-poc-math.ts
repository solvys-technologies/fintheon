// [claude-code 2026-04-26] S45-T1: pure-function volume-profile math.
// timeAnchoredVWAP, pointOfControl, valueArea (70% volume around POC),
// expectedMove (IV% × spot × VIX-multiplier × √(daysToEvent / 365)).

export interface OHLCVBar {
  /** Epoch ms */
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ValueArea {
  vah: number;
  val: number;
  poc: number;
}

/** Volume-weighted average price anchored to a starting timestamp. */
export function timeAnchoredVWAP(
  bars: OHLCVBar[],
  anchorTs: number,
): number | null {
  let pvSum = 0;
  let vSum = 0;
  for (const bar of bars) {
    if (bar.timestamp < anchorTs) continue;
    if (!Number.isFinite(bar.volume) || bar.volume <= 0) continue;
    const typical = (bar.high + bar.low + bar.close) / 3;
    pvSum += typical * bar.volume;
    vSum += bar.volume;
  }
  if (vSum === 0) return null;
  return pvSum / vSum;
}

/**
 * Build a price → volume histogram across the bar set, bucketed at `tickSize`,
 * and return the price level where the most volume was transacted (POC).
 */
export function pointOfControl(
  bars: OHLCVBar[],
  tickSize: number = 1,
): number | null {
  const histogram = buildVolumeHistogram(bars, tickSize);
  if (histogram.size === 0) return null;
  let bestBucket = NaN;
  let bestVolume = -Infinity;
  for (const [bucket, volume] of histogram) {
    if (volume > bestVolume) {
      bestVolume = volume;
      bestBucket = bucket;
    }
  }
  if (!Number.isFinite(bestBucket)) return null;
  return bestBucket * tickSize + tickSize / 2;
}

/**
 * Value area: smallest contiguous price band around POC containing
 * `threshold` (default 70%) of total volume. Returns VAH / VAL / POC.
 */
export function valueArea(
  bars: OHLCVBar[],
  threshold: number = 0.7,
  tickSize: number = 1,
): ValueArea | null {
  const histogram = buildVolumeHistogram(bars, tickSize);
  if (histogram.size === 0) return null;

  let totalVolume = 0;
  let pocBucket = NaN;
  let pocVolume = -Infinity;
  for (const [bucket, volume] of histogram) {
    totalVolume += volume;
    if (volume > pocVolume) {
      pocVolume = volume;
      pocBucket = bucket;
    }
  }
  if (!Number.isFinite(pocBucket) || totalVolume === 0) return null;

  const target = totalVolume * threshold;
  let accumulated = pocVolume;
  let lo = pocBucket;
  let hi = pocBucket;

  while (accumulated < target) {
    const above = histogram.get(hi + 1) ?? 0;
    const below = histogram.get(lo - 1) ?? 0;
    if (above === 0 && below === 0) break;
    if (above >= below) {
      hi += 1;
      accumulated += above;
    } else {
      lo -= 1;
      accumulated += below;
    }
  }

  return {
    poc: pocBucket * tickSize + tickSize / 2,
    val: lo * tickSize,
    vah: hi * tickSize + tickSize,
  };
}

/**
 * Expected move (in price units) until a catalyst:
 *   move = spot × IV% × VIXMultiplier × √(daysToEvent / 365)
 *
 * `ivPct` is implied vol expressed as a decimal (0.18 = 18%). VIX multiplier
 * comes from iv-scoring/computation.continuousVIXMultiplier.
 */
export function expectedMove(
  spot: number,
  ivPct: number,
  daysToEvent: number,
  vixMultiplier: number = 1,
): number {
  if (
    !Number.isFinite(spot) ||
    !Number.isFinite(ivPct) ||
    !Number.isFinite(daysToEvent)
  ) {
    return 0;
  }
  const days = Math.max(daysToEvent, 1 / 24);
  return spot * ivPct * vixMultiplier * Math.sqrt(days / 365);
}

function buildVolumeHistogram(
  bars: OHLCVBar[],
  tickSize: number,
): Map<number, number> {
  const histogram = new Map<number, number>();
  for (const bar of bars) {
    if (!Number.isFinite(bar.volume) || bar.volume <= 0) continue;
    const lo = Math.floor(Math.min(bar.high, bar.low) / tickSize);
    const hi = Math.floor(Math.max(bar.high, bar.low) / tickSize);
    const buckets = Math.max(hi - lo + 1, 1);
    const slice = bar.volume / buckets;
    for (let bucket = lo; bucket <= hi; bucket++) {
      histogram.set(bucket, (histogram.get(bucket) ?? 0) + slice);
    }
  }
  return histogram;
}
