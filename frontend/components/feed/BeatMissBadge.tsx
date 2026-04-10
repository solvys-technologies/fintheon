// [claude-code 2026-03-26] T4: Beat/miss badge for economic event cards
import React from "react";

interface BeatMissBadgeProps {
  status: "beat" | "miss" | "inline";
  surprisePercent?: number | null;
}

const STATUS_STYLES = {
  beat: "bg-emerald-500/15 text-emerald-400",
  miss: "bg-red-500/15 text-red-400",
  inline: "bg-zinc-800 text-zinc-400",
} as const;

export function BeatMissBadge({ status, surprisePercent }: BeatMissBadgeProps) {
  const style = STATUS_STYLES[status];
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
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold tracking-wider rounded-full ${style}`}
    >
      {label}
    </span>
  );
}
