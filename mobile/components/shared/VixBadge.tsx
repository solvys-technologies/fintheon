// [claude-code 2026-04-15] T3: Compact VIX badge — Doto font hero moment, gold flash on change
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVixStore } from "../../hooks/useVixTicker";

export function VixBadge() {
  const { value, changePercent, isStale } = useVixStore();
  const [flash, setFlash] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current && value !== 0) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 300);
      prevValue.current = value;
      return () => clearTimeout(t);
    }
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

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
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
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 24,
          color,
          lineHeight: 1,
        }}
      >
        {isStale || value === 0 ? "[--.-]" : value.toFixed(1)}
      </span>
      {!isStale && value !== 0 && (
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
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
