// [claude-code 2026-04-19] S26-P2 T5: theme picker rewritten per TP — "let's just make
//   it a drop-down menu, like a list drop-down menu... the preview swatch should be the
//   whole color... People should have the option to switch between the light theme and
//   the dark theme on a toggle inside of the menu that pops up from the hamburger menu."
//   Each row IS the full-bleed primary accent colour (44×full-width, rounded 8px). The
//   active theme gets a 2px inset ring in --fintheon-text. The NOTHING DESIGN divider
//   sits between the presets and the Nothing Design specials.
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "../shared/iso-icons";
import type { ThemeConfig } from "@frontend/lib/theme";
import { useHaptic } from "../../hooks/useHaptic";

const NOTHING_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

interface ThemePickerAccordionProps {
  current: ThemeConfig;
  onPick: (t: ThemeConfig) => void;
  standard: Record<string, ThemeConfig>;
  special: Record<string, ThemeConfig>;
}

/** Luminance-based contrast pick so a row label reads cleanly on its swatch.
 *  Simple relative-luminance approximation — good enough for hex accents. */
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
  // Perceptual luminance (Rec. 709)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? "#0a0a0a" : "#ffffff";
}

export function ThemePickerAccordion({
  current,
  onPick,
  standard,
  special,
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
                themes={standard}
                current={current}
                onPick={handlePick}
              />
              {Object.keys(special).length > 0 && (
                <>
                  <div
                    style={{
                      marginTop: 14,
                      marginBottom: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontFamily: "var(--font-data)",
                      fontSize: 9,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "var(--text-disabled)",
                    }}
                  >
                    <span>NOTHING DESIGN</span>
                    <span
                      aria-hidden
                      style={{
                        flex: 1,
                        height: 1,
                        background:
                          "color-mix(in srgb, var(--accent) 10%, transparent)",
                      }}
                    />
                  </div>
                  <SwatchList
                    themes={special}
                    current={current}
                    onPick={handlePick}
                  />
                </>
              )}
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
