// [claude-code 2026-04-28] S48-T2: Speculation filter for wire-source noise.
// Standalone module. T5 wires the import into content-guard.ts.
// Hedged-language patterns indicate speculation, not confirmed facts.
// Default action for wire items: demote (score x0.7).
// Other source types: block (drop entirely).
// Exception: economic-calendar pipeline always passes.

export type SpeculationAction = "block" | "demote" | "off";

export const SPECULATION_DEMOTE_FACTOR = 0.7;

const SPECULATION_PATTERNS: RegExp[] = [
  /\breportedly\b/i,
  /\bsources\s+say\b/i,
  /\bcould\s+(?:be|see|lead|trigger|push|cause)\b/i,
  /\bmight\s+(?:be|see|signal|indicate)\b/i,
  /\brumored\b/i,
  /\ballegedly\b/i,
  /\bpurportedly\b/i,
  /\bunconfirmed\b/i,
  /\bpossibly\b/i,
  /\bit\s+appears\b/i,
  /\bsome\s+analysts?\s+(?:believe|think|say|expect)\b/i,
  /\btalks?\s+of\b/i,
  /\b(?:under|being)\s+consider(?:ed|ing)\b/i,
  /\bhinting\b/i,
];

export function isSpeculative(headline: string, body?: string): boolean {
  const text = `${headline} ${body ?? ""}`;
  return SPECULATION_PATTERNS.some((p) => p.test(text));
}

export function getSpeculationAction(
  headline: string,
  body: string,
  sourceType?: string,
  ingestPipeline?: string,
): SpeculationAction {
  if (ingestPipeline === "economic-calendar") return "off";
  if (!isSpeculative(headline, body)) return "off";
  return sourceType === "wire" ? "demote" : "block";
}
