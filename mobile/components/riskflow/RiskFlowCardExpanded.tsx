// [claude-code 2026-04-29] S51: deleted duplicate body block, added t-text-reveal for
//   headline remainder via framer-motion, gated DEVIATION row on econ-print tag,
//   stripped EVENT WEIGHT/TIMING/MOMENTUM/VIX CONTEXT rows, replaced IVFuseBar footer
//   with sawdust fuse bar (10-segment horizontal bar with vertical ruler ticks).
// [claude-code 2026-04-20] Footer row added: horizontal IV bar picks up the
//   juice from the preview card's drained vertical fuse (fills 0→IV on mount),
//   paperclip icon right-justified links to the original source, and the IV
//   numeral sits far-right at the very bottom. Replaces the old inline
//   [OPEN SOURCE] text link for the mini surface.
// [claude-code 2026-04-15] T5: Expanded card content — inline detail view with agent notes, sub-scores, symbols
// [claude-code 2026-04-19] Surface-gated SourcePreview — when rendering in the full or
//   timeline surface, the expanded card shows the scraped body in a SourcePreview block
//   with YouTube + open-original CTAs; mini surfaces keep the legacy [OPEN SOURCE] link.
import { motion } from "framer-motion";
import { Paperclip } from "lucide-react";
import type { MobileRiskFlowAlert } from "../../contexts/RiskFlowContext";
import { SourcePreview } from "./SourcePreview";

export type RiskFlowExpandedSurface = "full" | "timeline" | "mini";

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

export function RiskFlowCardExpanded({
  alert,
  surface = "mini",
  ivScore,
  severityColor,
}: RiskFlowCardExpandedProps) {
  const showSourcePreview = surface === "full" || surface === "timeline";
  const showFooter =
    !showSourcePreview && ivScore != null && severityColor != null;
  const ivFillPercent = Math.max(0, Math.min(100, ((ivScore ?? 0) / 10) * 100));
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{ overflow: "hidden" }}
    >
      <div
        className="pb-4 pt-2 fade-divider-top"
        style={{ borderTop: "none", padding: "8px 12px 16px 26px" }}
      >
        {/* [claude-code 2026-04-25] S35: hero image — RSS enclosure / og:image, hidden
            on load failure so a broken image never breaks the expanded card. */}
        {alert.imageUrl && (
          <a
            href={alert.url ?? alert.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "block",
              marginBottom: "12px",
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid var(--border)",
            }}
          >
            <img
              src={alert.imageUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const wrap = e.currentTarget
                  .parentElement as HTMLElement | null;
                if (wrap) wrap.style.display = "none";
              }}
              style={{
                width: "100%",
                maxHeight: "200px",
                objectFit: "cover",
                display: "block",
              }}
            />
          </a>
        )}

        {/* S51: t-text-reveal — remainder of headline streams in on expand */}
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            color: "var(--text-primary)",
            lineHeight: 1.6,
            marginBottom: "12px",
          }}
        >
          {alert.title}
        </motion.p>

        {/* Source preview (full/timeline) — no duplicate content text for mini */}
        {showSourcePreview && <SourcePreview alert={alert} />}

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

        {/* S51: DEVIATION row — only if econ-print tag + surprisePercent */}
        {Array.isArray(alert.tags) &&
          alert.tags.includes("econ-print") &&
          alert.econData?.surprisePercent != null && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: "11px",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                }}
              >
                DEVIATION
              </span>
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: "11px",
                  color: "var(--text-primary)",
                }}
              >
                {alert.econData.surprisePercent.toFixed(1)}
              </span>
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

        {/* S51: Sawdust fuse footer — 10-segment horizontal bar with vertical
            ruler ticks, paperclip, and IV score. Replaces the old IVFuseBar. */}
        {showFooter && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 4,
            }}
          >
            {/* Sawdust bar — horizontal with 9 vertical tick dividers */}
            <div
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: "var(--fintheon-surface, #0a0a00)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${ivFillPercent}%` }}
                transition={{ duration: 0.72, ease: [0.16, 0.8, 0.24, 1] }}
                style={{
                  height: "100%",
                  background: severityColor,
                  borderRadius: 2,
                  position: "absolute",
                  left: 0,
                  top: 0,
                }}
              />
              {/* Vertical tick marks */}
              {Array.from({ length: 9 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${((i + 1) / 10) * 100}%`,
                    width: 1,
                    background: "var(--fintheon-bg, #050402)",
                    pointerEvents: "none",
                  }}
                  aria-hidden
                />
              ))}
            </div>

            {/* Paperclip → original source */}
            {alert.url && (
              <a
                href={alert.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label="Open original source"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  color: "var(--text-secondary)",
                  borderRadius: 6,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <Paperclip size={16} />
              </a>
            )}

            {/* IV numeral — far right, Doto */}
            <span
              style={{
                fontFamily:
                  "'Doto', 'Readable Digits', var(--font-data, monospace)",
                fontSize: 14,
                fontWeight: 600,
                color: severityColor,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.02em",
                lineHeight: 1,
                minWidth: 32,
                textAlign: "right",
              }}
            >
              {(ivScore ?? 0).toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
