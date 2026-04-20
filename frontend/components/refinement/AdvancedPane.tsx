// [claude-code 2026-04-18] S24-T4: Advanced pane — collapsible wrapper for per-event / commentator / source tweaks
import { useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "@/components/shared/iso-icons";

export function AdvancedPane({
  children,
  defaultOpen = false,
  count,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        borderTop: "1px solid var(--fintheon-glass-border)",
        marginTop: 8,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 4px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--fintheon-text)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SlidersHorizontal size={12} color="var(--fintheon-accent)" />
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--fintheon-text)",
            }}
          >
            Advanced
          </span>
          {typeof count === "number" && (
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 9,
                letterSpacing: "0.06em",
                color: "var(--fintheon-muted)",
              }}
            >
              {count} knob{count === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <ChevronDown
          size={12}
          style={{
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 140ms ease",
            opacity: 0.6,
          }}
        />
      </button>
      {open && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            paddingTop: 4,
            paddingBottom: 12,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
