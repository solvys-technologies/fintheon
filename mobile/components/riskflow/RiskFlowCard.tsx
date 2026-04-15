// [claude-code 2026-04-15] T5: RiskFlow card — severity-colored left border, tap to expand, swipe to dismiss
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { MobileRiskFlowAlert } from "../../contexts/RiskFlowContext";
import type { AlertSeverity } from "@frontend/lib/riskflow-feed";
import { timeAgo } from "@frontend/lib/time-utils";
import { SurfaceCard } from "../shared/SurfaceCard";
import { SeverityBadge } from "../shared/SeverityBadge";
import { SwipeAction } from "../shared/SwipeAction";
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <SwipeAction onSwipeLeft={() => onDismiss(alert.id)}>
        <SurfaceCard
          accentBorder="left"
          noPadding
          style={{
            borderLeftColor: severityColor,
            borderRadius: 0,
            marginBottom: 1,
          }}
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              {/* Title */}
              <h3
                className="flex-1"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "14px",
                  color: "var(--text-primary)",
                  lineHeight: 1.4,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  margin: 0,
                }}
              >
                {alert.title}
              </h3>
              {/* Severity badge */}
              <SeverityBadge severity={alert.severity} />
            </div>

            {/* Source + timestamp row */}
            <div
              className="flex items-center gap-1 mt-1.5"
              style={{
                fontFamily: "var(--font-data)",
                fontSize: "11px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
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

          {/* Expanded content */}
          <AnimatePresence>
            {expanded && <RiskFlowCardExpanded alert={alert} />}
          </AnimatePresence>
        </SurfaceCard>
      </SwipeAction>
    </motion.div>
  );
}
