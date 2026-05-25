// [claude-code 2026-04-30] Econ deviation / beat-miss visuals use the same bullish·bearish
// CSS variables as the rest of RiskFlow (SettingsContext → fusePalette → :root).
// Fallbacks match DEFAULT_TRADE_COLORS / DEFAULT_FUSE_PALETTE when vars are unset.

/** Text + chip fill for BEAT / MISS / IN LINE — tied to user bullish·bearish prefs */
export function econBeatMissPresentation(status: "beat" | "miss" | "inline"): {
  color: string;
  backgroundColor: string;
} {
  const bullish = "var(--fintheon-bullish, #c79f4a)";
  const bearish = "var(--fintheon-bearish, #b4443a)";
  const neutral = "var(--fintheon-muted, #6b6b6b)";
  const color =
    status === "beat" ? bullish : status === "miss" ? bearish : neutral;
  return {
    color,
    backgroundColor: `color-mix(in srgb, ${color} 17%, transparent)`,
  };
}

/** Signed deviation % vs forecast — positive → bullish color, negative → bearish */
export function econSignedDeviationColor(deviationPercent: number): string {
  const bullish = "var(--fintheon-bullish, #c79f4a)";
  const bearish = "var(--fintheon-bearish, #b4443a)";
  const neutral = "var(--fintheon-muted, #6b6b6b)";
  if (deviationPercent > 0) return bullish;
  if (deviationPercent < 0) return bearish;
  return neutral;
}
