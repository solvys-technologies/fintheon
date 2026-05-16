// [claude-code 2026-05-16] Simplified to Something Solvys + Something Monochrome only
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { ThemeConfig } from "@frontend/lib/theme";
import { useHaptic } from "../../hooks/useHaptic";

const NOTHING_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

interface ThemePickerAccordionProps {
  current: ThemeConfig;
  onPick: (t: ThemeConfig) => void;
  themes: Record<string, ThemeConfig>;
}

function textOnSwatch(hex: string): string {
  const clean = hex.replace("#", "");
  const n =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? "#0a0a0a" : "#ffffff";
}

export function ThemePickerAccordion({
  current,
  onPick,
  themes,
}: ThemePickerAccordionProps) {
  const vibrate = useHaptic();
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    vibrate(6);
    setOpen((v) => !v);
  }, [vibrate]);

  const handlePick = useCallback(
    (t: ThemeConfig) => {
      vibrate(10);
      onPick(t);
    },
    [vibrate, onPick],
  );

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
          marginBottom: 8,
        }}
      >
        THEME
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{
          width: "100%",
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "0 14px",
          background: current.accent,
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
          boxShadow: open ? `inset 0 0 0 2px var(--fintheon-text)` : "none",
          transition: "box-shadow 180ms ease",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            fontWeight: 500,
            color: textOnSwatch(current.accent),
            letterSpacing: "0.02em",
          }}
        >
          {current.label}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: NOTHING_EASE }}
          style={{
            display: "inline-flex",
            color: textOnSwatch(current.accent),
            opacity: 0.7,
          }}
        >
          <ChevronDown size={18} strokeWidth={1.6} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="theme-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: NOTHING_EASE }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ paddingTop: 10 }}>
              <SwatchList
                themes={themes}
                current={current}
                onPick={handlePick}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SwatchList({
  themes,
  current,
  onPick,
}: {
  themes: Record<string, ThemeConfig>;
  current: ThemeConfig;
  onPick: (t: ThemeConfig) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {Object.values(themes).map((t) => {
        const active = current.name === t.name;
        const fg = textOnSwatch(t.accent);
        return (
          <button
            key={t.name}
            type="button"
            onClick={() => onPick(t)}
            aria-pressed={active}
            style={{
              width: "100%",
              height: 44,
              display: "flex",
              alignItems: "center",
              padding: "0 14px",
              background: t.accent,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              boxShadow: active
                ? `inset 0 0 0 2px var(--fintheon-text)`
                : "none",
              transition: "box-shadow 180ms ease, transform 120ms ease",
              textAlign: "left",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                color: fg,
                letterSpacing: "0.02em",
              }}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
