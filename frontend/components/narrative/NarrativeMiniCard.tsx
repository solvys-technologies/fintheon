// [claude-code 2026-03-28] S5-T3+T5: Mini card with severity-driven visual weight + living motion
import { useMemo } from "react";
import type { CatalystCard } from "../../lib/narrative-types";
import {
  severityScale,
  severityOpacity,
  severityBorderWidth,
  CARD_ENTER_CLASS,
  SEVERITY_PULSE_CLASS,
  staggerDelay,
} from "../../lib/narrative-motion";

interface NarrativeMiniCardProps {
  card: CatalystCard;
  isSelected: boolean;
  isImported: boolean;
  onClick: () => void;
  onDrillDown?: () => void;
  staggerIndex?: number;
}

const SEVERITY_BORDER: Record<string, string> = {
  high: "var(--fintheon-bearish)",
  medium: "var(--fintheon-accent)",
  low: "color-mix(in srgb, var(--fintheon-muted) 40%, transparent)",
};

const DIRECTION_ARROW: Record<string, { char: string; color: string }> = {
  bullish: { char: "\u25B2", color: "var(--fintheon-bullish)" },
  bearish: { char: "\u25BC", color: "var(--fintheon-bearish)" },
  neutral: { char: "\u2014", color: "var(--fintheon-muted)" },
};

import { timeAgo } from "../../lib/time-utils";

export default function NarrativeMiniCard({
  card,
  isSelected,
  isImported,
  onClick,
  staggerIndex = 0,
}: NarrativeMiniCardProps) {
  const dir = useMemo(() => {
    const bias = card.directionBias ?? card.sentiment ?? "neutral";
    return DIRECTION_ARROW[bias] ?? DIRECTION_ARROW.neutral;
  }, [card.directionBias, card.sentiment]);

  const instrument = card.narrativeIds?.[0] ?? "";
  const firstTag = card.tags?.[0];
  const ivScore = card.marketImpact?.nq?.percent ?? null;

  const scale = severityScale(card.severity);
  const opacity = severityOpacity(card.severity);
  const borderW = severityBorderWidth(card.severity);
  const pulseClass = card.severity === "high" ? SEVERITY_PULSE_CLASS : "";

  return (
    <div
      className={`rounded cursor-pointer select-none transition-all duration-150 relative overflow-hidden ${CARD_ENTER_CLASS} ${pulseClass}`}
      style={{
        width: "160px",
        minHeight: "80px",
        padding: "6px 8px",
        border: `1px solid ${isSelected ? "var(--fintheon-accent)" : "color-mix(in srgb, var(--fintheon-border) 25%, transparent)"}`,
        borderLeftWidth: `${borderW}px`,
        borderLeftColor: SEVERITY_BORDER[card.severity] ?? SEVERITY_BORDER.low,
        backgroundColor: isSelected
          ? "color-mix(in srgb, var(--fintheon-accent) 8%, var(--fintheon-surface))"
          : "color-mix(in srgb, var(--fintheon-surface) 80%, transparent)",
        backdropFilter: "blur(12px)",
        transform: `scale(${scale})`,
        opacity,
        boxShadow: isSelected
          ? "0 0 12px rgba(199,159,74,0.15)"
          : "0 2px 6px rgba(0,0,0,0.2)",
        ...staggerDelay(staggerIndex),
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform =
          `scale(${scale}) translateY(-1px)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = `scale(${scale})`;
      }}
    >
      {/* Imported indicator */}
      {isImported && (
        <span
          className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: "var(--fintheon-accent)" }}
        />
      )}

      {/* Row 1: severity dot + title */}
      <div className="flex items-start gap-1">
        <span
          className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: SEVERITY_BORDER[card.severity] }}
        />
        <p
          className="text-[10px] font-semibold leading-tight truncate"
          style={{ color: "var(--fintheon-text)" }}
        >
          {card.title}
        </p>
      </div>

      {/* Row 2: direction + instrument + recency */}
      <div className="flex items-center gap-1 mt-1">
        <span
          className="text-[9px] font-mono font-bold"
          style={{ color: dir.color }}
        >
          {dir.char}
        </span>
        <span
          className="text-[8px] font-mono uppercase"
          style={{ color: dir.color }}
        >
          {card.directionBias ?? card.sentiment}
        </span>
        {instrument && (
          <span
            className="text-[8px] font-mono"
            style={{ color: "var(--fintheon-muted)" }}
          >
            {instrument}
          </span>
        )}
        <span
          className="text-[8px] ml-auto"
          style={{ color: "var(--fintheon-muted)" }}
        >
          {timeAgo(card.date)}
        </span>
      </div>

      {/* Row 3: category badge + first tag */}
      <div className="flex items-center gap-1 mt-1">
        {card.category && (
          <span
            className="text-[7px] font-mono uppercase px-1 py-0.5 rounded"
            style={{
              color: "var(--fintheon-muted)",
              backgroundColor:
                "color-mix(in srgb, var(--fintheon-muted) 12%, transparent)",
            }}
          >
            {card.category}
          </span>
        )}
        {firstTag && (
          <span
            className="text-[7px] font-mono px-1 py-0.5 rounded"
            style={{
              color: "var(--fintheon-accent)",
              backgroundColor:
                "color-mix(in srgb, var(--fintheon-accent) 12%, transparent)",
            }}
          >
            {firstTag}
          </span>
        )}
      </div>

      {/* Row 4: IV score if available */}
      {ivScore !== null && (
        <div className="flex items-center gap-1 mt-1">
          <span
            className="text-[8px] font-mono"
            style={{ color: "var(--fintheon-accent)" }}
          >
            &#x26A1; {ivScore.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
}
