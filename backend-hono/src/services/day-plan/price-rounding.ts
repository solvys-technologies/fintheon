// [claude-code 2026-05-06] S59-T4: added roundTo80or20, roundTo25multiple, invalidationOffset for
//   desk plan entry/target/invalidation handle snapping per TP's 80/20 entry + 25-multiple target rules.

interface RoundingProfile {
  anchor: number;
  fine: number;
}

const PROFILES: Record<string, RoundingProfile> = {
  "/NQ": { anchor: 80, fine: 20 },
  "/ES": { anchor: 10, fine: 5 },
  "/YM": { anchor: 50, fine: 25 },
  "/RTY": { anchor: 5, fine: 2.5 },
};

const DEFAULT: RoundingProfile = { anchor: 1, fine: 0.25 };

function profileFor(instrument: string): RoundingProfile {
  return PROFILES[instrument.toUpperCase()] ?? DEFAULT;
}

function snap(price: number, increment: number): number {
  if (!Number.isFinite(price) || increment <= 0) return price;
  return Math.round(price / increment) * increment;
}

export function roundEntry(price: number, instrument: string): number {
  const { anchor } = profileFor(instrument);
  return snap(price, anchor);
}

export function roundFine(price: number, instrument: string): number {
  const { fine } = profileFor(instrument);
  return snap(price, fine);
}

/** Snap to nearest handle ending in 80 or 20 (e.g. 21880, 21920). */
export function roundTo80or20(price: number, instrument: string): number {
  if (!Number.isFinite(price)) return price;
  const hundred = Math.floor(price / 100) * 100;
  const rem = price - hundred;
  // Valid handles: 20 and 80 within each hundred-block
  const candidates = [hundred + 20, hundred + 80, hundred + 120, hundred + 180];
  let best = candidates[0]!;
  let bestDist = Math.abs(price - best);
  for (const c of candidates) {
    const d = Math.abs(price - c);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}

/** Snap to nearest handle ending in 00, 25, 50, or 75. */
export function roundTo25multiple(price: number): number {
  if (!Number.isFinite(price)) return price;
  const quarter = Math.round(price / 25) * 25;
  // Ensure it's one of 00, 25, 50, 75
  return quarter;
}

/** Invalidation = Entry 2 ± offset (below for longs, above for shorts). */
export function invalidationOffset(
  entry2: number,
  direction: "long" | "short",
): number {
  const offset = 35; // ~35 points breathing room
  return direction === "long" ? entry2 - offset : entry2 + offset;
}

/** Round a list of prices-of-interest to anchor handles, dedupe, and sort. */
export function roundPricesOfInterest(
  prices: number[],
  instrument: string,
): number[] {
  const seen = new Set<number>();
  const rounded: number[] = [];
  for (const raw of prices) {
    if (!Number.isFinite(raw)) continue;
    const value = roundEntry(raw, instrument);
    if (seen.has(value)) continue;
    seen.add(value);
    rounded.push(value);
  }
  rounded.sort((a, b) => a - b);
  return rounded;
}

export function isInstrumentSupported(instrument: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    PROFILES,
    instrument.toUpperCase(),
  );
}
