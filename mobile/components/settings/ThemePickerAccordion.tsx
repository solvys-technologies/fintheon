// [claude-code 2026-04-19] TP beta polish: accordion-style theme picker. Collapsed row
//   shows the active accent + label + chevron. Expanded reveals a chip grid of standard
//   themes and, under a muted "NOTHING DESIGN" divider, the special Nothing presets.
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { ThemeConfig } from "@frontend/lib/theme";
import { useHaptic } from "../../hooks/useHaptic";

const NOTHING_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

interface ThemePickerAccordionProps {
  current: ThemeConfig;
  onPick: (t: ThemeConfig) => void;
  standard: Record<string, ThemeConfig>;
  special: Record<string, ThemeConfig>;
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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 14px",
          background: "color-mix(in srgb, var(--accent) 4%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--accent) 18%, transparent)",
          borderRadius: 10,
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
          transition: "border-color 200ms ease, background 200ms ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ThemeSwatch theme={current} active ringless size={28} dotSize={10} />
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "var(--text-primary)",
            }}
          >
            {current.label}
          </span>
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: NOTHING_EASE }}
          style={{
            display: "inline-flex",
            color: "var(--text-secondary)",
          }}
        >
          <ChevronDown size={18} strokeWidth={1.6} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="theme-grid"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: NOTHING_EASE }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ paddingTop: 12 }}>
              <ThemeGrid
                themes={standard}
                current={current}
                onPick={handlePick}
              />
              {Object.keys(special).length > 0 && (
                <>
                  <div
                    style={{
                      marginTop: 16,
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
                  <ThemeGrid
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

function ThemeGrid({
  themes,
  current,
  onPick,
}: {
  themes: Record<string, ThemeConfig>;
  current: ThemeConfig;
  onPick: (t: ThemeConfig) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(58px, 1fr))",
        gap: 10,
      }}
    >
      {Object.values(themes).map((t) => {
        const active = current.name === t.name;
        return (
          <button
            key={t.name}
            onClick={() => onPick(t)}
            title={t.label}
            aria-label={t.label}
            aria-pressed={active}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: 0,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <ThemeSwatch theme={t} active={active} />
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 9,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: active ? "var(--accent)" : "var(--text-disabled)",
                textAlign: "center",
                lineHeight: 1.2,
                maxWidth: 70,
                overflow: "hidden",
                textOverflow: "ellipsis",
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

function ThemeSwatch({
  theme,
  active,
  ringless = false,
  size = 44,
  dotSize = 12,
}: {
  theme: ThemeConfig;
  active: boolean;
  ringless?: boolean;
  size?: number;
  dotSize?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: theme.bg,
        border:
          !ringless && active
            ? `1.5px solid var(--accent)`
            : "1px solid color-mix(in srgb, var(--accent) 16%, transparent)",
        position: "relative",
        boxShadow:
          !ringless && active
            ? "0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent)"
            : "none",
        transition: "box-shadow 200ms ease, border-color 200ms ease",
      }}
    >
      <div
        aria-hidden
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          background: theme.accent,
          position: "absolute",
          bottom: 5,
          right: 5,
        }}
      />
    </div>
  );
}
