// [claude-code 2026-04-30] "solvys fuses" baseline — horizontal fuse uses
//   linear increments (10-step ruler) to match vertical fuse segmentation.
// [claude-code 2026-04-18] v5.22 S2: Nothing-Design flatten + shared palette adoption +
//   4.2s shimmer. Track is opaque var(--fintheon-surface), no accent border, no inner
//   glow on the fill. Color resolves through colorForSeverity from mobile/lib/fuse-palette
//   so user-preferences fusePalette overrides flow through later (when S1 ships).
// [claude-code 2026-04-19] S25: horizontal IV fuse — severity-sensitive color ramp, number
//   right-justified on the same row. Fill animates in from 0 on mount for a subtle "charge"
//   feel. The IV number springs in from 0.6 opacity so it reads as "settled" after the fill.
import { motion } from "framer-motion";
import {
  colorForSeverity,
  type FuseSeverity as PaletteSeverity,
} from "../../lib/fuse-palette";

/** Local subset re-exported for legacy call-sites. Palette accepts the wider union
 *  ("neutral") but mobile UI never sets it, so this narrower set keeps callers honest. */
export type FuseSeverity = Exclude<PaletteSeverity, "neutral">;

interface Props {
  /** Normalized to 0-100 for fill percent. RiskFlow scores are 0-10; we × 10 here. */
  iv: number;
  /** Severity tier controls color ramp. */
  severity?: FuseSeverity;
  /** Label printed on the left above the fuse (e.g. "URGENCY · IV"). */
  label?: string;
  /** Override the display number (defaults to `iv`). Keeps 10-scale scores readable. */
  display?: string;
  /** 10-scale (default) renders "8.4"; 100-scale renders "84". */
  scale?: "10" | "100";
}

export function IVFuseBar({
  iv,
  severity = "medium",
  label,
  display,
  scale = "10",
}: Props) {
  const safeIv = Number.isFinite(iv) ? iv : 0;
  const normalized =
    scale === "10"
      ? Math.max(0, Math.min(100, (safeIv / 10) * 100))
      : Math.max(0, Math.min(100, safeIv));

  const color = colorForSeverity(severity);
  const segments = 10;
  const displayValue =
    display ??
    (scale === "10" ? safeIv.toFixed(1) : Math.round(safeIv).toString());

  return (
    <div style={{ width: "100%" }}>
      {/* Header row — label left, value right */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 9,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}
        >
          {label ?? "IV"}
        </span>
        <motion.span
          key={displayValue}
          initial={{ opacity: 0.55, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 30 }}
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 13,
            color,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          }}
        >
          {displayValue}
        </motion.span>
      </div>

      {/* Nothing-Design fuse — opaque surface track, severity fill, no shimmer per TP. */}
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: "var(--fintheon-surface, #0a0a00)",
          overflow: "hidden",
          position: "relative",
        }}
        data-solvys-fuse="true"
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${normalized}%` }}
          transition={{ duration: 0.72, ease: [0.16, 0.8, 0.24, 1] }}
          style={{
            height: "100%",
            background: color,
            borderRadius: 2,
          }}
        />
        {Array.from({ length: Math.max(0, segments - 1) }, (_, i) => {
          const left = ((i + 1) / segments) * 100;
          return (
            <span
              key={i}
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${left}%`,
                width: 1,
                background: "var(--fintheon-bg, #050402)",
                pointerEvents: "none",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
