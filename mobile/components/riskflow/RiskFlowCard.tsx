// [claude-code 2026-04-20] Tap-to-expand restored per TP — tap the card now
//   expands RiskFlowCardExpanded inline (not the DetailSheet modal). The
//   vertical fuse drains on tap, fades to zero opacity, then the expanded
//   card's horizontal fuse fills from 0 to the real IV score at the footer.
//   Right-column IV/chevron fades out during expansion so the footer IV at
//   the far right of the expanded card takes over. Preview stays at the
//   original 3-line clamp + static min-height.
// [claude-code 2026-04-18] v5.22 S2: severity color now resolved through
//   colorForSeverity from mobile/lib/fuse-palette so user-preferences fusePalette
//   overrides apply uniformly. Card geometry + drain choreography unchanged.
// [claude-code 2026-04-19] S26-P2 T10: IV fuse drain choreography per TP — "this cool
//   micro interaction that kind of depletes the IV gauge on the left and then fills it
//   down in the footer when it expands." On tap: drain the vertical fuse to 0 over
//   ~220ms, THEN reveal the expanded card. The expanded card's horizontal IV bar
//   fills from 0 to the real score on mount, completing the visual hand-off.
// [claude-code 2026-04-16] RiskFlow card — haptic on expand
// [claude-code 2026-04-19] Polish pass: IV numeral now renders in Doto explicitly
//   (var(--font-data) was getting mapped to a heavier mono on some themes), matching
//   desktop's right-stacked IVStack. Chevron stays in the right column above the numeral.
import { useCallback, useState } from "react";
import { ChevronUp, ChevronDown, Minus } from "lucide-react";
import { useHaptic } from "../../hooks/useHaptic";
import { motion, AnimatePresence } from "framer-motion";
import type { MobileRiskFlowAlert } from "../../contexts/RiskFlowContext";
import type { AlertSeverity } from "@frontend/lib/riskflow-feed";
import { timeAgo } from "@frontend/lib/time-utils";
import { SwipeAction } from "../shared/SwipeAction";
import { VerticalFuseBar } from "../shared/VerticalFuseBar";
import { CARD_PRESS } from "../../lib/sheet-motion";
import { colorForSeverity, type FuseSeverity } from "../../lib/fuse-palette";
import { bucketOf } from "../../lib/source-buckets";
import { RiskFlowCardExpanded } from "./RiskFlowCardExpanded";

/** How long the drain takes — covers the staggered top-down segment fade. Keep this
 *  in sync with VerticalFuseBar's `transitionDelay` formula (segments × 18ms + 150ms buffer). */
const DRAIN_DURATION_MS = 220;
/** How long the fuse fades out once fully drained, before the expanded card reveals. */
const FUSE_FADE_MS = 140;

interface RiskFlowCardProps {
  alert: MobileRiskFlowAlert;
  onDismiss: (id: string) => void;
  index?: number;
}

/** AlertSeverity is the same critical/high/medium/low set as the palette's FuseSeverity
 *  minus "neutral" — narrower union, so the cast through paletteSeverity is sound. */
function paletteSeverity(sev: AlertSeverity): FuseSeverity {
  return sev as FuseSeverity;
}

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
  const [draining, setDraining] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const severityColor = colorForSeverity(paletteSeverity(alert.severity));
  const ivScore = alert.ivScore ?? 0;

  const handleTap = useCallback(() => {
    if (expanded) {
      // Collapse: hide expanded section, restore fuse
      setExpanded(false);
      setDraining(false);
      vibrate(6);
      return;
    }
    if (draining) return;
    vibrate(8);
    setDraining(true);
    // Wait for the drain to empty + a short fade, then reveal the expanded card
    window.setTimeout(() => {
      setExpanded(true);
    }, DRAIN_DURATION_MS + FUSE_FADE_MS);
  }, [expanded, draining, vibrate]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: "easeOut" }}
    >
      <SwipeAction onSwipeLeft={() => onDismiss(alert.id)} onTap={handleTap}>
        <motion.div
          whileTap={CARD_PRESS}
          role="button"
          tabIndex={0}
          aria-label={
            expanded
              ? `Collapse headline: ${alert.title}`
              : `Expand headline: ${alert.title}`
          }
          aria-expanded={expanded}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleTap();
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
            {/* Left: Vertical fuse bar — drains on tap, then fades; the expanded
                card's horizontal bar picks up the juice on the footer. */}
            <motion.div
              animate={{ opacity: expanded ? 0 : 1 }}
              transition={{ duration: FUSE_FADE_MS / 1000 }}
              style={{ display: "flex", alignItems: "stretch" }}
            >
              <VerticalFuseBar
                value={ivScore}
                color={severityColor}
                draining={draining || expanded}
                animateIn
              />
            </motion.div>

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
                <span>
                  {bucketOf({
                    source: alert.source,
                    riskType: alert.riskType,
                  })}
                </span>
                <span style={{ color: "var(--text-disabled)" }}>&middot;</span>
                <span>{timeAgo(alert.publishedAt)}</span>
              </div>

              {/* Headline — 3-line clamp when collapsed, full text when expanded. */}
              <h3
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--text-primary)",
                  lineHeight: 1.45,
                  margin: 0,
                  ...(expanded
                    ? { wordBreak: "break-word" as const }
                    : {
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical" as const,
                        overflow: "hidden",
                      }),
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

            {/* Right: Direction chevron + IV score — fades during expansion, the
                expanded card's footer takes over this role. */}
            <motion.div
              animate={{ opacity: expanded ? 0 : 1 }}
              transition={{ duration: FUSE_FADE_MS / 1000 }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                justifyContent: "center",
                flexShrink: 0,
                width: 36,
                gap: 1,
              }}
            >
              <DirectionChevron
                direction={alert.direction}
                color={severityColor}
              />
              <span
                style={{
                  fontFamily:
                    "'Doto', 'Readable Digits', var(--font-data, monospace)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: severityColor,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "0.02em",
                  lineHeight: 1,
                }}
              >
                {ivScore.toFixed(1)}
              </span>
            </motion.div>
          </div>

          {/* Expanded body — sub-scores, agent notes, and the footer row with
              the horizontal fuse handoff + paperclip + far-right IV numeral. */}
          <AnimatePresence initial={false}>
            {expanded && (
              <RiskFlowCardExpanded
                alert={alert}
                surface="mini"
                ivScore={ivScore}
                severityColor={severityColor}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </SwipeAction>
    </motion.div>
  );
}
