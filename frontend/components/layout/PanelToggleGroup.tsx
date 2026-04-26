// [claude-code 2026-04-26] VS Code-style three-panel toggle group. Lives in
// TopHeader to the right of the VIX/IV scoring widget per TP. Each button
// shows a 14×14 rect glyph with the active side filled in accent gold; the
// inactive sides are outlined at accent/30. Click toggles its respective
// panel collapse state.
//
// Order (matches the IDE convention TP referenced):
//   left   = NavSidebar   (collapses leftmost rail)
//   footer = FooterToolbar (collapses bottom toolbar)
//   right  = Strategium   (collapses combined panel)

interface PanelToggleGroupProps {
  leftCollapsed: boolean;
  onToggleLeft: () => void;
  footerCollapsed: boolean;
  onToggleFooter: () => void;
  rightCollapsed: boolean;
  onToggleRight: () => void;
}

interface IconProps {
  side: "left" | "footer" | "right";
  active: boolean;
}

function PanelIcon({ side, active }: IconProps) {
  const accent = "var(--fintheon-accent)";
  const stroke = active ? accent : `color-mix(in srgb, ${accent} 50%, transparent)`;
  const fill = active ? accent : "transparent";
  // Outer 14x14 frame with internal divider; the side adjacent to the
  // toggle's panel is filled when active = panel is OPEN.
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
        stroke={stroke}
        strokeWidth="1"
      />
      {/* Active panel fill */}
      {side === "left" && (
        <rect x="1.5" y="2.5" width="3.5" height="9" rx="1" fill={fill} />
      )}
      {side === "right" && (
        <rect x="9" y="2.5" width="3.5" height="9" rx="1" fill={fill} />
      )}
      {side === "footer" && (
        <rect x="1.5" y="8" width="11" height="3.5" rx="1" fill={fill} />
      )}
    </svg>
  );
}

export function PanelToggleGroup({
  leftCollapsed,
  onToggleLeft,
  footerCollapsed,
  onToggleFooter,
  rightCollapsed,
  onToggleRight,
}: PanelToggleGroupProps) {
  const baseBtn =
    "w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-[var(--fintheon-accent)]/10";
  return (
    <div
      className="flex items-center gap-0.5 bg-[var(--fintheon-bg)] border border-zinc-800 rounded-lg px-1 h-7 flex-shrink-0"
      role="group"
      aria-label="Panel toggles"
    >
      <button
        type="button"
        onClick={onToggleLeft}
        className={baseBtn}
        title={leftCollapsed ? "Show left panel" : "Hide left panel"}
        aria-label={leftCollapsed ? "Show left panel" : "Hide left panel"}
        aria-pressed={!leftCollapsed}
      >
        <PanelIcon side="left" active={!leftCollapsed} />
      </button>
      <button
        type="button"
        onClick={onToggleFooter}
        className={baseBtn}
        title={footerCollapsed ? "Show footer" : "Hide footer"}
        aria-label={footerCollapsed ? "Show footer" : "Hide footer"}
        aria-pressed={!footerCollapsed}
      >
        <PanelIcon side="footer" active={!footerCollapsed} />
      </button>
      <button
        type="button"
        onClick={onToggleRight}
        className={baseBtn}
        title={rightCollapsed ? "Show right panel" : "Hide right panel"}
        aria-label={rightCollapsed ? "Show right panel" : "Hide right panel"}
        aria-pressed={!rightCollapsed}
      >
        <PanelIcon side="right" active={!rightCollapsed} />
      </button>
    </div>
  );
}
