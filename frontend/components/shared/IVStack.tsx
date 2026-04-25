// [claude-code 2026-04-24] Doto numeral now uses t-digit-group pop-in (solvys-transitions) so the
//   IV score cascades in when the card mounts or the score changes.
// [claude-code 2026-04-19] RiskFlow card polish: shared right-column IV stack used by every
//   desktop RiskFlow card variant. Direction chevron sits ABOVE the IV number, both rendered
//   right-aligned in the Nothing Design display font (Doto). Mirrors the Fintheon Mobile
//   RiskFlow card anatomy. Single source of truth so tweaks apply across AlertCardBase,
//   AlertRow, TradeIdeaRow and SanctumRiskAssessment without drift.
import { ChevronUp, ChevronDown, Minus } from "lucide-react";
import type { CSSProperties } from "react";
import { ivHeatColor } from "../../types/agent-desk";

export type IVStackDirection = "Bullish" | "Bearish" | "Neutral" | null;

interface IVStackProps {
  /** IV score 0-10. Renders the dot-matrix Doto numeral. */
  score: number | null | undefined;
  direction?: IVStackDirection;
  /** Override color for both chevron and IV number. Falls back to ivHeatColor(score). */
  color?: string;
  /** Pixel width of the right column. Default 36. */
  width?: number;
  /** IV number font size in px. Default 13. */
  fontSize?: number;
  /** Chevron icon size in px. Default 14. */
  chevronSize?: number;
  className?: string;
  style?: CSSProperties;
}

function Chevron({
  direction,
  color,
  size,
}: {
  direction: IVStackDirection;
  color: string;
  size: number;
}) {
  if (direction === "Bullish")
    return <ChevronUp size={size} color="var(--fintheon-bullish)" />;
  if (direction === "Bearish")
    return <ChevronDown size={size} color="var(--fintheon-bearish)" />;
  return <Minus size={Math.max(10, size - 2)} color={color} />;
}

export function IVStack({
  score,
  direction = null,
  color,
  width = 36,
  fontSize = 13,
  chevronSize = 14,
  className,
  style,
}: IVStackProps) {
  const hasScore = score != null;
  const numericScore = hasScore ? Number(score) : 0;
  const resolvedColor = color ?? ivHeatColor(numericScore);

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        justifyContent: "center",
        flexShrink: 0,
        width,
        gap: 1,
        lineHeight: 1,
        ...style,
      }}
    >
      <Chevron direction={direction} color={resolvedColor} size={chevronSize} />
      {hasScore && (
        <span
          style={{
            fontFamily:
              "'Doto', 'Readable Digits', var(--font-data, monospace)",
            fontSize,
            fontWeight: 600,
            color: resolvedColor,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.02em",
            lineHeight: 1,
          }}
        >
          {numericScore.toFixed(1)}
        </span>
      )}
    </div>
  );
}
