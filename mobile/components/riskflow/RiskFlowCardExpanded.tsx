// [claude-code 2026-04-15] T5: Expanded card content — inline detail view with agent notes, sub-scores, symbols
import { motion } from "framer-motion";
import type { MobileRiskFlowAlert } from "../../contexts/RiskFlowContext";
import type { AlertSeverity } from "@frontend/lib/riskflow-feed";

interface RiskFlowCardExpandedProps {
  alert: MobileRiskFlowAlert;
}

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: "var(--fintheon-severe)",
  high: "var(--fintheon-severe)",
  medium: "var(--fintheon-neutral-severe)",
  low: "var(--fintheon-neutral)",
};

function SubScoreRow({
  label,
  value,
  severity,
}: {
  label: string;
  value: number;
  severity: AlertSeverity;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: "11px",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: "11px",
          color: SEVERITY_COLORS[severity],
        }}
      >
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export function RiskFlowCardExpanded({ alert }: RiskFlowCardExpandedProps) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{ overflow: "hidden" }}
    >
      <div
        className="px-4 pb-4 pt-2"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {/* Content text */}
        {alert.content && (
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              color: "var(--text-primary)",
              lineHeight: 1.6,
              marginBottom: "12px",
            }}
          >
            {alert.content}
          </p>
        )}

        {/* Agent notes */}
        {alert.agentNote && (
          <div className="mb-3">
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: "10px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: "4px",
              }}
            >
              AGENT NOTES
            </span>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                color: "var(--text-primary)",
                lineHeight: 1.5,
              }}
            >
              {alert.agentNote}
            </p>
          </div>
        )}

        {/* Sub-scores */}
        {alert.subScores && (
          <div className="mb-3">
            <SubScoreRow
              label="EVENT WEIGHT"
              value={alert.subScores.eventWeight}
              severity={alert.severity}
            />
            <SubScoreRow
              label="TIMING"
              value={alert.subScores.timing}
              severity={alert.severity}
            />
            <SubScoreRow
              label="DEVIATION"
              value={alert.subScores.deviation}
              severity={alert.severity}
            />
            <SubScoreRow
              label="MOMENTUM"
              value={alert.subScores.momentum}
              severity={alert.severity}
            />
            <SubScoreRow
              label="VIX CONTEXT"
              value={alert.subScores.vixContext}
              severity={alert.severity}
            />
          </div>
        )}

        {/* Symbol chips */}
        {alert.symbols && alert.symbols.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {alert.symbols.map((sym) => (
              <span
                key={sym}
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: "10px",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--accent)",
                  border: "1px solid var(--accent)",
                  borderRadius: "999px",
                  padding: "2px 8px",
                }}
              >
                {sym}
              </span>
            ))}
          </div>
        )}

        {/* External link */}
        {alert.url && (
          <a
            href={alert.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "var(--font-data)",
              fontSize: "11px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--interactive)",
              textDecoration: "none",
            }}
          >
            [OPEN SOURCE]
          </a>
        )}
      </div>
    </motion.div>
  );
}
