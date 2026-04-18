// [claude-code 2026-04-19] TP beta polish: full 5-font picker matching desktop. Each
//   row renders the heading font as a sample so the selection is self-evident.
import { Check } from "lucide-react";
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
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 14px",
                background: active
                  ? "color-mix(in srgb, var(--accent) 6%, transparent)"
                  : "color-mix(in srgb, var(--accent) 2%, transparent)",
                border: active
                  ? "1px solid color-mix(in srgb, var(--accent) 40%, transparent)"
                  : "1px solid color-mix(in srgb, var(--accent) 14%, transparent)",
                borderRadius: 10,
                cursor: "pointer",
                textAlign: "left",
                WebkitTapHighlightColor: "transparent",
                transition: "border-color 200ms ease, background 200ms ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <span
                  style={{
                    fontFamily: f.fontHeading,
                    fontSize: 18,
                    color: "var(--text-primary)",
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
              </div>
              <span
                aria-hidden
                style={{
                  display: "inline-flex",
                  opacity: active ? 1 : 0,
                  color: "var(--accent)",
                  transition: "opacity 200ms ease",
                }}
              >
                <Check size={18} strokeWidth={2} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
