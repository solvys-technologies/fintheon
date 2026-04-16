// [claude-code 2026-04-16] RiskFlow card — X-style: fuse bar left, source top-left, headline center, chevron+IV right
import { useState } from "react";
import { ChevronUp, ChevronDown, Minus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { MobileRiskFlowAlert } from "../../contexts/RiskFlowContext";
import type { AlertSeverity } from "@frontend/lib/riskflow-feed";
import { timeAgo } from "@frontend/lib/time-utils";
import { SwipeAction } from "../shared/SwipeAction";
import { VerticalFuseBar } from "../shared/VerticalFuseBar";
import { RiskFlowCardExpanded } from "./RiskFlowCardExpanded";

interface RiskFlowCardProps {
  alert: MobileRiskFlowAlert;
  onDismiss: (id: string) => void;
  index?: number;
}

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: "var(--fintheon-severe)",
  high: "var(--fintheon-severe)",
  medium: "var(--fintheon-neutral-severe)",
  low: "var(--fintheon-neutral)",
};

function formatSource(source: string): string {
  const map: Record<string, string> = {
    FinancialJuice: "FJ",
    "financial-juice": "FJ",
    TwitterCli: "X",
    rettiwt: "X",
    Rettiwt: "X",
    EconomicCalendar: "ECON",
    "economic-calendar": "ECON",
    OSINTSources: "OSINT",
    "osint-sources": "OSINT",
    Polymarket: "POLY",
    polymarket: "POLY",
    Kalshi: "KALSHI",
    "kalshi-whale": "KALSHI",
    DeItaOne: "DELTA",
    Hermes: "HERMES",
    backend: "FEED",
  };
  return map[source] || source.toUpperCase().slice(0, 6);
}

function DirectionChevron({
  direction,
  color,
}: {
  direction: string | null | undefined;
  color: string;
}) {
  if (direction === "Bullish")
    return <ChevronUp size={14} color="var(--fintheon-bullish)" />;
  if (direction === "Bearish")
    return <ChevronDown size={14} color="var(--fintheon-bearish)" />;
  return <Minus size={12} color={color} />;
}

export function RiskFlowCard({
  alert,
  onDismiss,
  index = 0,
}: RiskFlowCardProps) {
  const [expanded, setExpanded] = useState(false);
  const severityColor = SEVERITY_COLORS[alert.severity];
  const ivScore = alert.ivScore ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: "easeOut" }}
    >
      <SwipeAction onSwipeLeft={() => onDismiss(alert.id)}>
        <div
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: "var(--surface)",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              padding: "12px 14px",
              gap: 10,
              minHeight: 60,
            }}
          >
            {/* Left: Vertical fuse bar */}
            <VerticalFuseBar value={ivScore} color={severityColor} />

            {/* Center: Source + Headline + Author */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 3,
              }}
            >
              {/* Source + time */}
              <div
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>{formatSource(alert.source)}</span>
                <span style={{ color: "var(--text-disabled)" }}>&middot;</span>
                <span>{timeAgo(alert.publishedAt)}</span>
              </div>

              {/* Headline */}
              <h3
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--text-primary)",
                  lineHeight: 1.45,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical" as const,
                  overflow: "hidden",
                  margin: 0,
                }}
              >
                {alert.title}
              </h3>

              {/* Author handle */}
              {alert.authorHandle && (
                <span
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 10,
                    color: "var(--text-disabled)",
                    letterSpacing: "0.02em",
                  }}
                >
                  @{alert.authorHandle}
                </span>
              )}
            </div>

            {/* Right: Direction chevron + IV score, vertically centered */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                width: 32,
                gap: 2,
              }}
            >
              <DirectionChevron
                direction={alert.direction}
                color={severityColor}
              />
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
                  color: severityColor,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}
              >
                {ivScore.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Expanded content */}
          <AnimatePresence>
            {expanded && <RiskFlowCardExpanded alert={alert} />}
          </AnimatePresence>
        </div>
      </SwipeAction>
    </motion.div>
  );
}
