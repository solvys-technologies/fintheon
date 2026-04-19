// [claude-code 2026-04-19] S26-P2 T5: font picker adopts the same full-bleed dropdown
//   pattern as the theme picker per TP. Each row renders the heading font live at 18px
//   with the data font as a secondary descriptor so the row itself IS the preview. The
//   active row gets the 2px inset ring.
import type { FontTheme } from "@frontend/lib/font-theme";
import { useHaptic } from "../../hooks/useHaptic";

interface FontPickerListProps {
  current: FontTheme;
  onPick: (f: FontTheme) => void;
  fonts: Record<string, FontTheme>;
}

export function FontPickerList({
  current,
  onPick,
  fonts,
}: FontPickerListProps) {
  const vibrate = useHaptic();

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
        FONT
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {Object.values(fonts).map((f) => {
          const active = current.id === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                vibrate(10);
                onPick(f);
              }}
              aria-pressed={active}
              style={{
                width: "100%",
                minHeight: 44,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 2,
                padding: "8px 14px",
                background: "transparent",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                textAlign: "left",
                WebkitTapHighlightColor: "transparent",
                boxShadow: active
                  ? `inset 0 0 0 2px var(--fintheon-text)`
                  : `inset 0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent)`,
                transition: "box-shadow 180ms ease",
              }}
            >
              <span
                style={{
                  fontFamily: f.fontHeading,
                  fontSize: 18,
                  color: active ? "var(--accent)" : "var(--text-primary)",
                  letterSpacing: f.id === "nothing" ? "0.05em" : "0.01em",
                }}
              >
                {f.label}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  color: "var(--text-secondary)",
                }}
              >
                {f.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
