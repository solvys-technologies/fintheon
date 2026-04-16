// [claude-code 2026-04-15] RiskFlow card — vertical fuse bar left, headline center, IV score right, no Kanban borders
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { MobileRiskFlowAlert } from "../../contexts/RiskFlowContext";
import type { AlertSeverity } from "@frontend/lib/riskflow-feed";
import { timeAgo } from "@frontend/lib/time-utils";
import { SwipeAction } from "../shared/SwipeAction";
import { VerticalFuseBar } from "../shared/VerticalFuseBar";
import { RiskFlowCardExpanded } from "./RiskFlowCardExpanded";

interface RiskFlowCardProps {
  alert: MobileRiskFlowAlert;
  onDismiss: (id: string) => void;
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

export function RiskFlowCard({ alert, onDismiss }: RiskFlowCardProps) {
  const [expanded, setExpanded] = useState(false);
  const severityColor = SEVERITY_COLORS[alert.severity];
  const ivScore = alert.ivScore ?? 0;

  return (
    <SwipeAction onSwipeLeft={() => onDismiss(alert.id)}>
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          background: "var(--surface)",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {/* Main card row: fuse | headline | IV score */}
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            padding: "10px 12px",
            gap: 10,
            minHeight: 56,
          }}
        >
          {/* Left: Vertical fuse bar */}
          <VerticalFuseBar value={ivScore} color={severityColor} />

          {/* Center: Headline + metadata */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 4,
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "var(--text-primary)",
                lineHeight: 1.4,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
                margin: 0,
              }}
            >
              {alert.title}
            </h3>
            <div
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase" as const,
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>{formatSource(alert.source)}</span>
              <span style={{ color: "var(--text-disabled)" }}>&bull;</span>
              <span>{timeAgo(alert.publishedAt)}</span>
              {alert.authorHandle && (
                <>
                  <span style={{ color: "var(--text-disabled)" }}>&bull;</span>
                  <span style={{ color: "var(--text-disabled)" }}>
                    @{alert.authorHandle}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: IV score number */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              width: 36,
              justifyContent: "flex-end",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 11,
                color: severityColor,
                fontVariantNumeric: "tabular-nums",
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
  );
}
