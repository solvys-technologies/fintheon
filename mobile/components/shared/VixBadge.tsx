// [claude-code 2026-04-16] VixBadge — compact (toolbar: label left, smaller) vs hero (label above, full size)
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVixStore } from "../../hooks/useVixTicker";

interface VixBadgeProps {
  variant?: "compact" | "hero";
}

export function VixBadge({ variant = "compact" }: VixBadgeProps) {
  const { value, changePercent, isStale } = useVixStore();
  const [flash, setFlash] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current && prevValue.current !== 0 && value !== 0) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 400);
      prevValue.current = value;
      return () => clearTimeout(t);
    }
    prevValue.current = value;
  }, [value]);

  const color =
    isStale || value === 0
      ? "var(--text-disabled)"
      : value > 30
        ? "var(--error)"
        : value > 20
          ? "var(--warning)"
          : "var(--text-display)";

  const sign = changePercent >= 0 ? "+" : "";
  const isHero = variant === "hero";

  return (
    <div
      role="status"
      aria-label={
        isStale || value === 0 ? "VIX unavailable" : `VIX ${value.toFixed(1)}`
      }
      style={{
        position: "relative",
        display: "flex",
        flexDirection: isHero ? "column" : "row",
        alignItems: "center",
        gap: isHero ? 2 : 5,
      }}
    >
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{
              position: "absolute",
              inset: -4,
              borderRadius: 8,
              background: "var(--accent)",
              pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>

      {/* Label */}
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: isHero ? 10 : 9,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
          lineHeight: 1,
        }}
      >
        VIX
      </span>

      {/* Value */}
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: isHero ? 28 : 18,
          color,
          lineHeight: 1,
        }}
      >
        {isStale || value === 0 ? "[--.-]" : value.toFixed(1)}
      </span>

      {/* Change percent */}
      {!isStale && value !== 0 && (
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: isHero ? 11 : 9,
            color: "var(--text-secondary)",
            letterSpacing: "0.04em",
          }}
        >
          {sign}
          {changePercent.toFixed(1)}%
        </span>
      )}
    </div>
  );
}
