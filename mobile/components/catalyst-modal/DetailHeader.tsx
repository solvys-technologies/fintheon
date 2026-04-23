// [claude-code 2026-04-19] S25: shared header chrome for DetailSheet renderers — category
//   label, severity dot, timestamp, close button. Micro-interaction: close-button rotate on
//   tap, severity dot pulses softly (respects prefers-reduced-motion).
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

type Sev = "low" | "medium" | "high" | "critical";

interface Props {
  label: string;
  severity?: Sev;
  timeLabel?: string;
  onClose: () => void;
}

const sevColor: Record<Sev, string> = {
  low: "var(--text-disabled)",
  medium: "var(--accent)",
  high: "var(--warning, #f0b055)",
  critical: "var(--error, #d84f4f)",
};

export function DetailHeader({ label, severity, timeLabel, onClose }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 0 14px",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {severity && (
          <motion.span
            aria-hidden
            animate={
              reduceMotion
                ? {}
                : {
                    boxShadow: [
                      `0 0 0 0 ${sevColor[severity]}55`,
                      `0 0 0 6px ${sevColor[severity]}00`,
                    ],
                  }
            }
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: sevColor[severity],
            }}
          />
        )}
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}
        >
          {label}
        </span>
        {timeLabel && (
          <>
            <span style={{ color: "var(--text-disabled)" }}>·</span>
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 10,
                letterSpacing: "0.06em",
                color: "var(--text-disabled)",
              }}
            >
              {timeLabel}
            </span>
          </>
        )}
      </div>

      <motion.button
        type="button"
        aria-label="Close"
        onClick={onClose}
        whileTap={{ rotate: 90, scale: 0.94 }}
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
        style={{
          width: 34,
          height: 34,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border:
            "1px solid color-mix(in srgb, var(--accent) 16%, transparent)",
          borderRadius: 999,
          color: "var(--text-primary)",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <X size={16} />
      </motion.button>
    </div>
  );
}
