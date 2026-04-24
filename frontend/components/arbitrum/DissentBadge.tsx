// [claude-code 2026-04-24] S35-T3: inline dissent badge (seat + magnitude_pp)
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
      className={`inline-flex items-center gap-1 px-1.5 py-[1px] text-[10px] uppercase tracking-wider border border-[var(--fintheon-accent)]/60 text-[var(--fintheon-accent)]/90${className ? ` ${className}` : ""}`}
      title={dissent.rationale ?? undefined}
    >
      <span>{dissent.seat}</span>
      <span
        style={{ fontFamily: "Doto, ui-monospace, monospace" }}
        className="text-[11px]"
      >
        {sign}
        {dissent.magnitude_pp}pp
      </span>
    </span>
  );
}
