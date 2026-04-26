// [claude-code 2026-04-26] S45-T1: round entries / invalidations / targets to
// trader-friendly handles per instrument. /NQ uses 80- or 20-handles, /ES uses
// 5- or 10-handles, /YM uses 50-handles, /RTY uses 5-handles.

interface RoundingProfile {
  /** Anchor handle. The result snaps to multiples of this. */
  anchor: number;
  /** Smaller secondary handle used for tighter levels (invalidation). */
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
