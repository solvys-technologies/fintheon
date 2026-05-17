// [claude-code 2026-05-16] Ported from desktop DissentBadge for mobile.
import type { ArbitrumDissent } from "./types";

interface DissentBadgeProps {
  dissent: ArbitrumDissent | null | undefined;
  className?: string;
}

export function DissentBadge({ dissent, className }: DissentBadgeProps) {
  if (!dissent) return null;
  const sign = dissent.magnitude_pp > 0 ? "+" : "";
  return (
    <span
      className={className || ""}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 6px",
        fontSize: 10,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        border: "1px solid var(--accent)",
        color: "var(--accent)",
        fontFamily: "var(--font-data)",
        borderRadius: 4,
      }}
      title={dissent.rationale ?? undefined}
    >
      <span>{dissent.seat}</span>
      <span
        style={{
          fontFamily: "Doto, var(--font-data)",
          fontSize: 11,
        }}
      >
        {sign}
        {dissent.magnitude_pp}pp
      </span>
    </span>
  );
}
