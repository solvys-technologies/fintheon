// [claude-code 2026-04-26] Three-panel toggle group lives at the LEFT of the
// VIX widget per TP. Bare icon buttons (no outer pill bg/border). Left & footer
// use the custom rect glyph; right uses Lucide LayoutDashboard to read clearly
// as the Strategium toggle. Right-click on any button hides that panel
// entirely (onHide* callback) — left-click expands/collapses.
import { LayoutDashboard } from "lucide-react";

interface PanelToggleGroupProps {
  leftCollapsed: boolean;
  onToggleLeft: () => void;
  onHideLeft?: () => void;
  footerCollapsed: boolean;
  onToggleFooter: () => void;
  onHideFooter?: () => void;
  rightCollapsed: boolean;
  onToggleRight: () => void;
  onHideRight?: () => void;
}

interface IconProps {
  side: "left" | "footer";
  active: boolean;
}

function PanelIcon({ side, active }: IconProps) {
  const accent = "var(--fintheon-accent)";
  const stroke = active ? accent : `color-mix(in srgb, ${accent} 50%, transparent)`;
  const fill = active ? accent : "transparent";
  return (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      aria-hidden="true"
      className="shrink-0"
    >
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
      {side === "left" && (
        <rect x="1.5" y="2.5" width="3.5" height="9" rx="1" fill={fill} />
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
  onHideLeft,
  footerCollapsed,
  onToggleFooter,
  onHideFooter,
  rightCollapsed,
  onToggleRight,
  onHideRight,
}: PanelToggleGroupProps) {
  const baseBtn =
    "w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-[var(--fintheon-accent)]/10";
  const accent = "var(--fintheon-accent)";
  const dimAccent = `color-mix(in srgb, ${accent} 50%, transparent)`;
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0" role="group" aria-label="Panel toggles">
      <button
        type="button"
        onClick={onToggleLeft}
        onContextMenu={(e) => {
          if (!onHideLeft) return;
          e.preventDefault();
          onHideLeft();
        }}
        className={baseBtn}
        title={leftCollapsed ? "Expand left sidebar" : "Collapse left sidebar"}
        aria-label={leftCollapsed ? "Expand left sidebar" : "Collapse left sidebar"}
        aria-pressed={!leftCollapsed}
      >
        <PanelIcon side="left" active={!leftCollapsed} />
      </button>
      <button
        type="button"
        onClick={onToggleFooter}
        onContextMenu={(e) => {
          if (!onHideFooter) return;
          e.preventDefault();
          onHideFooter();
        }}
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
        onContextMenu={(e) => {
          if (!onHideRight) return;
          e.preventDefault();
          onHideRight();
        }}
        className={baseBtn}
        title={rightCollapsed ? "Open Strategium" : "Close Strategium"}
        aria-label={rightCollapsed ? "Open Strategium" : "Close Strategium"}
        aria-pressed={!rightCollapsed}
      >
        <LayoutDashboard
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: rightCollapsed ? dimAccent : accent }}
        />
      </button>
    </div>
  );
}
