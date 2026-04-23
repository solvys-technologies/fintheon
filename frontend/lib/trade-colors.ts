// [claude-code 2026-04-23] S30-T1 heatmaps + KPI flip — trade color helpers for
// GitHub-style activity heatmap (single-color intensity) and diverging daily-performance
// heatmap (bullish/bearish scaled by |% change|).
//
// Contract: all returned strings are 8-digit hex `#RRGGBBAA` (e.g. `#c79f4acc`) so
// callers can paste them straight into CSS `background` / `color` without a wrapper.

import { DEFAULT_TRADE_COLORS, type FusePalette } from "./fuse-palette";

export interface IntensityRange {
  min: number;
  max: number;
}

const MIN_ALPHA = 0.08;
const MAX_ALPHA = 0.92;

function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

function toAlphaHex(alpha01: number): string {
  const a = Math.round(clamp(alpha01, 0, 1) * 255);
  return a.toString(16).padStart(2, "0");
}

function normalizeHex(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  const raw = color.trim();
  if (raw.startsWith("#")) {
    if (raw.length === 9) return raw.slice(0, 7);
    if (raw.length === 7) return raw;
    if (raw.length === 4) {
      const [, r, g, b] = raw;
      return `#${r}${r}${g}${g}${b}${b}`;
    }
  }
  return fallback;
}

function withAlpha(hex6: string, alpha01: number): string {
  return `${hex6}${toAlphaHex(alpha01)}`;
}

function scaledAlpha(intensity01: number): number {
  if (intensity01 <= 0) return MIN_ALPHA;
  return MIN_ALPHA + (MAX_ALPHA - MIN_ALPHA) * clamp(intensity01, 0, 1);
}

export function getIntensityColor(
  value: number,
  palette: FusePalette | undefined,
  range: IntensityRange,
): string {
  const base = normalizeHex(
    palette?.bullishColor,
    DEFAULT_TRADE_COLORS.bullishColor,
  );
  const { min, max } = range;
  if (!Number.isFinite(value) || max <= min) {
    return withAlpha(base, MIN_ALPHA);
  }
  const norm = clamp((value - min) / (max - min), 0, 1);
  if (norm === 0) return withAlpha(base, MIN_ALPHA);
  return withAlpha(base, scaledAlpha(norm));
}

export function getDivergingColor(
  pct: number,
  palette: FusePalette | undefined,
  cap = 0.02,
): string {
  const bullish = normalizeHex(
    palette?.bullishColor,
    DEFAULT_TRADE_COLORS.bullishColor,
  );
  const bearish = normalizeHex(
    palette?.bearishColor,
    DEFAULT_TRADE_COLORS.bearishColor,
  );
  if (!Number.isFinite(pct) || pct === 0) {
    return withAlpha(bullish, MIN_ALPHA);
  }
  const magnitude = clamp(Math.abs(pct) / cap, 0, 1);
  const base = pct >= 0 ? bullish : bearish;
  return withAlpha(base, scaledAlpha(magnitude));
}

// @test — manual sanity checks (remove if these ever get promoted to a test file):
//   getIntensityColor(0, undefined, { min: 0, max: 10 })  -> `#c79f4a14`   (near-zero alpha)
//   getIntensityColor(10, undefined, { min: 0, max: 10 }) -> `#c79f4aeb`   (max alpha)
//   getDivergingColor(0.02, undefined)                    -> `#c79f4aeb`   (max bullish)
//   getDivergingColor(-0.02, undefined)                   -> `#b4443aeb`   (max bearish)
//   getDivergingColor(0.01, undefined)                    -> ~50% scaled bullish
