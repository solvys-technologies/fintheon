// [claude-code 2026-04-26] VS Code-style three-panel toggle group, restored
// after the v5.31.3 → 5.32.x sweep dropped it. Lives in TopHeader to the
// right of the VIX/IV widget. Each icon has a permanent thin divider line on
// the side it controls so the button is identifiable even when inactive
// (TP feedback: "draw a line in the disabled icons so users know which panel
// it triggers"). Active = panel currently OPEN; the side compartment fills
// with accent gold. Inactive = panel currently CLOSED; only the divider line
// shows.
//
// Order matches the IDE convention TP referenced:
//   left   = NavSidebar    (window event: fintheon:toggle-nav-sidebar)
//   footer = FooterToolbar (window event: fintheon:toggle-footer-panel)
//   right  = Strategium    (window event: fintheon:toggle-strategium)
//
// Each panel owner listens for its event and flips its own state. We use
// window events (instead of lifting state) so the toggle group is a
// drop-in widget that doesn't force a refactor of three different
// components' state ownership in one go.

import { useEffect, useState } from "react";

export type PanelSide = "left" | "footer" | "right";

const EVENT_NAME: Record<PanelSide, string> = {
  left: "fintheon:toggle-nav-sidebar",
  footer: "fintheon:toggle-footer-panel",
  right: "fintheon:toggle-strategium",
};

const STATE_EVENT_NAME: Record<PanelSide, string> = {
  left: "fintheon:nav-sidebar-state",
  footer: "fintheon:footer-panel-state",
  right: "fintheon:strategium-state",
};

interface PanelIconProps {
  side: PanelSide;
  active: boolean;
}

export function PanelIcon({ side, active }: PanelIconProps) {
  const accent = "var(--fintheon-accent)";
  const frameStroke = active
    ? accent
    : `color-mix(in srgb, ${accent} 55%, transparent)`;
  const dividerStroke = active
    ? accent
    : `color-mix(in srgb, ${accent} 75%, transparent)`;
  const fill = accent;
  return (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* Outer frame */}
      <rect
        x="1.5"
        y="2.5"
        width="11"
        height="9"
        rx="1.5"
        fill="none"
        stroke={frameStroke}
        strokeWidth="1"
      />
      {/* Permanent divider — visible even when inactive so the button is identifiable */}
      {side === "left" && (
        <line
          x1="5"
          y1="2.5"
          x2="5"
          y2="11.5"
          stroke={dividerStroke}
          strokeWidth="1"
        />
      )}
      {side === "right" && (
        <line
          x1="9"
          y1="2.5"
          x2="9"
          y2="11.5"
          stroke={dividerStroke}
          strokeWidth="1"
        />
      )}
      {side === "footer" && (
        <line
          x1="1.5"
          y1="8"
          x2="12.5"
          y2="8"
          stroke={dividerStroke}
          strokeWidth="1"
        />
      )}
      {/* Active fill — only when the panel is currently open */}
      {active && side === "left" && (
        <rect x="1.5" y="2.5" width="3.5" height="9" rx="1" fill={fill} />
      )}
      {active && side === "right" && (
        <rect x="9" y="2.5" width="3.5" height="9" rx="1" fill={fill} />
      )}
      {active && side === "footer" && (
        <rect x="1.5" y="8" width="11" height="3.5" rx="1" fill={fill} />
      )}
    </svg>
  );
}

interface PanelToggleButtonProps {
  side: PanelSide;
  label: string;
}

export function PanelToggleButton({ side, label }: PanelToggleButtonProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ open: boolean }>).detail;
      if (detail && typeof detail.open === "boolean") setOpen(detail.open);
    };
    window.addEventListener(STATE_EVENT_NAME[side], handler as EventListener);
    return () =>
      window.removeEventListener(
        STATE_EVENT_NAME[side],
        handler as EventListener,
      );
  }, [side]);

  const onClick = () => {
    window.dispatchEvent(new CustomEvent(EVENT_NAME[side]));
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-[var(--fintheon-accent)]/10"
      title={open ? `Hide ${label}` : `Show ${label}`}
      aria-label={open ? `Hide ${label}` : `Show ${label}`}
      aria-pressed={open}
    >
      <PanelIcon side={side} active={open} />
    </button>
  );
}

interface PanelToggleGroupProps {
  mode?: "full" | "right-only" | "hidden";
}

export function PanelToggleGroup({ mode = "full" }: PanelToggleGroupProps) {
  if (mode === "hidden") return null;

  return (
    // [claude-code 2026-04-26] Transparent group — no bg/border container per
    // TP. Buttons sit naked next to the iFrame dropdown + VIX ticker.
    <div
      className="flex items-center gap-0.5 h-7 flex-shrink-0"
      role="group"
      aria-label="Panel toggles"
    >
      {mode === "full" && <PanelToggleButton side="left" label="left panel" />}
      {mode === "full" && (
        <PanelToggleButton side="footer" label="footer panel" />
      )}
      <PanelToggleButton side="right" label="right panel" />
    </div>
  );
}
