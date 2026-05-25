// [claude-code 2026-03-26] T4: Beat/miss badge for economic event cards
// [claude-code 2026-04-30] Colors follow fuse palette bullish/bearish/muted (see econ-deviation-presentation).
import { econBeatMissPresentation } from "../../lib/econ-deviation-presentation";

interface BeatMissBadgeProps {
  status: "beat" | "miss" | "inline";
  surprisePercent?: number | null;
}

export function BeatMissBadge({ status, surprisePercent }: BeatMissBadgeProps) {
  const chip = econBeatMissPresentation(status);
  const pct =
    surprisePercent != null ? Math.abs(surprisePercent).toFixed(1) : null;

  let label: string;
  if (status === "beat") {
    label = pct ? `BEAT +${pct}%` : "BEAT";
  } else if (status === "miss") {
    label = pct ? `MISS ${pct}%` : "MISS";
  } else {
    label = "IN LINE";
  }

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider"
      style={chip}
    >
      {label}
    </span>
  );
}
