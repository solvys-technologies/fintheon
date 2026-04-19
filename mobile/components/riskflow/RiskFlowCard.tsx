// [claude-code 2026-04-19] S26-P2 T10: IV fuse drain choreography per TP — "this cool
//   micro interaction that kind of depletes the IV gauge on the left and then fills it
//   down in the footer when it expands." On tap: drain the vertical fuse to 0 over
//   ~220ms, THEN open the modal. The modal's horizontal IVFuseBar fills from 0 to the
//   real score on mount, completing the visual hand-off. Using the explicit approach
//   (B) from the brief because the vertical-to-horizontal rotation makes Framer's
//   layoutId crossfade look janky.
// [claude-code 2026-04-19] S25: tap now opens the full DetailSheet modal (deep view) instead
//   of inline expansion. Long-press still expands inline for quick triage (kept for power users
//   who scroll fast). Entry point is unified with CatalystCards + BriefingCard + push-tap flow.
// [claude-code 2026-04-16] RiskFlow card — haptic on expand
import { useCallback, useState } from "react";
import { ChevronUp, ChevronDown, Minus } from "lucide-react";
import { useHaptic } from "../../hooks/useHaptic";
import { motion } from "framer-motion";
import type { MobileRiskFlowAlert } from "../../contexts/RiskFlowContext";
import type { AlertSeverity } from "@frontend/lib/riskflow-feed";
import { timeAgo } from "@frontend/lib/time-utils";
import { SwipeAction } from "../shared/SwipeAction";
import { VerticalFuseBar } from "../shared/VerticalFuseBar";
import { useNotificationModal } from "../../contexts/NotificationModalContext";
import { CARD_PRESS } from "../../lib/sheet-motion";

/** How long the drain takes — covers the staggered top-down segment fade. Keep this
 *  in sync with VerticalFuseBar's `transitionDelay` formula (segments × 18ms + 150ms buffer). */
const DRAIN_DURATION_MS = 220;

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
  const vibrate = useHaptic();
  const { open } = useNotificationModal();
  const [draining, setDraining] = useState(false);
  const severityColor = SEVERITY_COLORS[alert.severity];
  const ivScore = alert.ivScore ?? 0;

  // Strip "backend-" prefix so modal matches feed-service item ids (id="tweet_id")
  const modalItemId = alert.id.startsWith("backend-")
    ? alert.id.slice("backend-".length)
    : alert.id;

  const openWithDrain = useCallback(() => {
    if (draining) return;
    vibrate(8);
    setDraining(true);
    window.setTimeout(() => {
      open({ kind: "riskflowItem", itemId: modalItemId });
      // Reset draining after the modal is up so if the user returns to this card
      // the fuse re-renders at full fill (VerticalFuseBar re-mounts are cheap).
      window.setTimeout(() => setDraining(false), 400);
    }, DRAIN_DURATION_MS);
  }, [draining, vibrate, open, modalItemId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: "easeOut" }}
    >
      <SwipeAction onSwipeLeft={() => onDismiss(alert.id)}>
        <motion.div
          onClick={openWithDrain}
          whileTap={CARD_PRESS}
          role="button"
          tabIndex={0}
          aria-label={`Open headline detail: ${alert.title}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openWithDrain();
            }
          }}
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
            {/* Left: Vertical fuse bar — drains on tap to hand juice to the modal footer */}
            <VerticalFuseBar
              value={ivScore}
              color={severityColor}
              draining={draining}
            />

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
        </motion.div>
      </SwipeAction>
    </motion.div>
  );
}
