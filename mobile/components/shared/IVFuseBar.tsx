// [claude-code 2026-04-19] S25: horizontal IV fuse — severity-sensitive color ramp, number
//   right-justified on the same row. Fill animates in from 0 on mount for a subtle "charge"
//   feel. The IV number springs in from 0.6 opacity so it reads as "settled" after the fill.
//   Palette via CSS vars so theme mode flips still work.
import { motion } from "framer-motion";

export type FuseSeverity = "low" | "medium" | "high" | "critical";

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

function severityColor(sev: FuseSeverity): string {
  switch (sev) {
    case "critical":
      return "var(--error, #d84f4f)";
    case "high":
      return "var(--warning, #f0b055)";
    case "medium":
      return "var(--accent, #c79f4a)";
    default:
      return "var(--text-secondary, #b8b09c)";
  }
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

  const color = severityColor(severity);
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

      {/* Fuse — accent-bordered track, severity-colored fill */}
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: "color-mix(in srgb, var(--accent) 8%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${normalized}%` }}
          transition={{ duration: 0.72, ease: [0.16, 0.8, 0.24, 1] }}
          style={{
            height: "100%",
            background: color,
            borderRadius: 2,
            // Subtle inner glow along the fill edge — TP glass aesthetic
            boxShadow: `0 0 10px color-mix(in srgb, ${color} 45%, transparent)`,
          }}
        />
      </div>
    </div>
  );
}
