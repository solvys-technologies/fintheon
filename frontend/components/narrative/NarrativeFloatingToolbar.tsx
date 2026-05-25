// [claude-code 2026-05-16] S68-T4: Added onResetView prop and Reset View button in zoom dropdown
// [claude-code 2026-04-19] S25-T6: Added computer-chip toggle in the actions row that shows/hides the NarrativeCanvasChat input (hidden by default).
// [claude-code 2026-03-28] S8-T2: Unified bottom bar — static toolkit + expandable command-palette chat
import { useState } from "react";
import {
  Hand,
  MousePointer2,
  Download,
  Zap,
  Filter,
  Map,
  SquareDashedMousePointer,
  Cpu,
} from "lucide-react";
import { NarrativeCanvasChat } from "./NarrativeCanvasChat";

export type CanvasTool = "select" | "hand" | "multi-select";

interface NarrativeFloatingToolbarProps {
  activeTool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  onImport: () => void;
  onToggleSanctum: (page?: number) => void;
  onToggleHeatmap: () => void;
  onToggleFilter: () => void;
  sanctumActive: boolean;
  heatmapActive: boolean;
  filterActive: boolean;
  scale: number;
  onZoomTo?: (level: number) => void;
  onFitView?: () => void;
  onResetView?: () => void;
  filterTooltip?: string;
  /** Card chips dragged/added from canvas for chat context */
  pendingChips?: { id: string; title: string }[];
  onClearChip?: (id: string) => void;
}

interface ToolBtn {
  id: string;
  icon: typeof Hand;
  tooltip: string;
  shortcut?: string;
}

const TOOLS: (ToolBtn & { tool: CanvasTool })[] = [
  {
    id: "select",
    tool: "select",
    icon: MousePointer2,
    tooltip: "Select",
    shortcut: "V",
  },
  {
    id: "hand",
    tool: "hand",
    icon: Hand,
    tooltip: "Hand (pan)",
    shortcut: "Space",
  },
  {
    id: "multi",
    tool: "multi-select",
    icon: SquareDashedMousePointer,
    tooltip: "Multi-select",
    shortcut: "Shift/Cmd",
  },
];

const ACTIONS: (ToolBtn & { onClick: string })[] = [
  {
    id: "import",
    onClick: "import",
    icon: Download,
    tooltip: "Import RiskFlow",
  },
  { id: "heatmap", onClick: "heatmap", icon: Map, tooltip: "Severity heatmap" },
  {
    id: "filter",
    onClick: "filter",
    icon: Filter,
    tooltip: "Filter by sentiment",
  },
  {
    id: "chat",
    onClick: "chat",
    icon: Cpu,
    tooltip: "Chat with Harper",
  },
  {
    id: "sanctum",
    onClick: "sanctum",
    icon: Zap,
    tooltip: "Analysis surfaces",
    shortcut: "S",
  },
];

const ZOOM_PRESETS = [
  { label: "25%", value: 0.25 },
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "100%", value: 1.0 },
  { label: "150%", value: 1.5 },
  { label: "200%", value: 2.0 },
];

export function NarrativeFloatingToolbar({
  activeTool,
  onToolChange,
  onImport,
  onToggleSanctum,
  onToggleHeatmap,
  onToggleFilter,
  sanctumActive,
  heatmapActive,
  filterActive,
  scale,
  onZoomTo,
  onFitView,
  onResetView,
  filterTooltip = "Filter by sentiment",
  pendingChips,
  onClearChip,
}: NarrativeFloatingToolbarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [sanctumOpen, setSanctumOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);

  const handleAction = (id: string) => {
    switch (id) {
      case "import":
        setChatOpen(true);
        setChatDrawerOpen(true);
        onImport();
        break;
      case "sanctum":
        setSanctumOpen((v) => !v);
        break;
      case "heatmap":
        onToggleHeatmap();
        break;
      case "filter":
        onToggleFilter();
        break;
      case "chat":
        setChatOpen((open) => {
          if (open) setChatDrawerOpen(false);
          return !open;
        });
        break;
    }
  };

  const isActionActive = (id: string) => {
    if (id === "sanctum") return sanctumActive;
    if (id === "heatmap") return heatmapActive;
    if (id === "filter") return filterActive;
    return false;
  };

  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-4 z-40 flex flex-col items-center gap-2">
      {/* Chat section — hidden by default, toggled by the Cpu chip below */}
      <NarrativeCanvasChat
        pendingChips={pendingChips}
        onClearChip={onClearChip}
        isOpen={chatOpen}
        drawerOpen={chatDrawerOpen}
        onDrawerOpenChange={setChatDrawerOpen}
        onDismiss={() => {
          setChatDrawerOpen(false);
          setChatOpen(false);
        }}
      />

      {/* Toolbar section — static, always visible */}
      <div className="narrative-floating-toolbar narrative-fade-item pointer-events-auto flex items-center gap-0.5 rounded-[6px] border border-[color-mix(in_srgb,var(--fintheon-accent)_16%,transparent)] bg-[color-mix(in_srgb,var(--fintheon-surface)_88%,var(--fintheon-bg))] px-1 py-0.5">
        {/* Tool group */}
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const active = activeTool === t.tool;
          return (
            <div
              key={t.id}
              className="relative"
              onMouseEnter={() => setHoveredId(t.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <button
                onClick={() => onToolChange(t.tool)}
                aria-label={t.tooltip}
                title={t.tooltip}
                className={`narrative-toolbar-button rounded-md p-1.5 transition-all duration-150 hover:shadow-[0_0_16px_color-mix(in_srgb,var(--fintheon-accent)_14%,transparent)] ${
                  active
                    ? "bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]"
                    : "text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-surface)]/60"
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={active ? 2.5 : 1.5} />
              </button>
              {hoveredId === t.id && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
                  <div className="flex items-center gap-2 whitespace-nowrap rounded-[4px] border border-[color-mix(in_srgb,var(--fintheon-accent)_18%,transparent)] bg-[var(--fintheon-bg)] px-2 py-1">
                    <span className="text-[10px] text-[var(--fintheon-text)]/80">
                      {t.tooltip}
                    </span>
                    {t.shortcut && (
                      <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-[var(--fintheon-surface)]/60 text-[var(--fintheon-muted)]/50">
                        {t.shortcut}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Divider */}
        <div className="mx-0.5 h-5 w-px bg-[var(--fintheon-border)]/20" />

        {/* Action group */}
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          const active = isActionActive(a.id);
          const tooltip = a.id === "filter" ? filterTooltip : a.tooltip;
          return (
            <div
              key={a.id}
              className="relative"
              onMouseEnter={() => setHoveredId(a.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <button
                onClick={() => handleAction(a.onClick)}
                aria-label={tooltip}
                title={tooltip}
                className={`narrative-toolbar-button rounded-md p-1.5 transition-all duration-150 hover:shadow-[0_0_16px_color-mix(in_srgb,var(--fintheon-accent)_14%,transparent)] ${
                  active ||
                  (a.id === "sanctum" && sanctumOpen) ||
                  (a.id === "chat" && chatOpen)
                    ? "bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]"
                    : "text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-surface)]/60"
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={active ? 2.5 : 1.5} />
              </button>
              {/* Sanctum dropdown */}
              {a.id === "sanctum" && sanctumOpen && (
                <div className="t-dropdown is-open absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 min-w-[170px] rounded-lg border border-[var(--fintheon-border)]/20 bg-[var(--fintheon-bg)] overflow-hidden" data-origin="bottom-center">
                  {[
                    { label: "Workspace", page: 0 },
                    { label: "Forecasts", page: 1 },
                    { label: "Coliseum", page: 2 },
                  ].map((item) => (
                    <button
                      key={item.page}
                      onClick={() => {
                        onToggleSanctum(item.page);
                        setSanctumOpen(false);
                      }}
                      aria-label={`Open ${item.label}`}
                      title={item.label}
                      className="w-full text-left px-3 py-1.5 text-[10px] text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/5 transition-colors"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
              {hoveredId === a.id && !sanctumOpen && (
                <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2">
                  <div className="flex items-center gap-2 whitespace-nowrap rounded-[4px] border border-[color-mix(in_srgb,var(--fintheon-accent)_18%,transparent)] bg-[var(--fintheon-bg)] px-2 py-1">
                    <span className="text-[10px] text-[var(--fintheon-text)]/80">
                      {tooltip}
                    </span>
                    {a.shortcut && (
                      <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-[var(--fintheon-surface)]/60 text-[var(--fintheon-muted)]/50">
                        {a.shortcut}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Divider */}
        <div className="mx-0.5 h-5 w-px bg-[var(--fintheon-border)]/20" />

        {/* Zoom dropdown */}
        <div className="relative">
          <button
            onClick={() => setZoomOpen((v) => !v)}
            aria-label="Zoom controls"
            title="Zoom controls"
            className="narrative-toolbar-button grid h-[26px] min-w-[34px] place-items-center rounded-md px-1.5 py-1 text-center text-[9px] leading-none text-[var(--fintheon-muted)]/50 transition-all duration-150 hover:bg-[var(--fintheon-surface)]/60 hover:text-[var(--fintheon-text)] hover:shadow-[0_0_16px_color-mix(in_srgb,var(--fintheon-accent)_14%,transparent)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {Math.round(scale * 100)}%
          </button>
          {zoomOpen && (
            <div className="t-dropdown is-open absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 min-w-[130px] rounded-lg border border-[var(--fintheon-border)]/20 bg-[var(--fintheon-bg)] overflow-hidden" data-origin="bottom-center">
              {ZOOM_PRESETS.map((z) => (
                <button
                  key={z.label}
                  onClick={() => {
                    onZoomTo?.(z.value);
                    setZoomOpen(false);
                  }}
                  aria-label={`Zoom to ${z.label}`}
                  title={`Zoom to ${z.label}`}
                  className={`w-full text-left px-3 py-1.5 text-[10px] flex items-center justify-between transition-colors ${
                    Math.abs(scale - z.value) < 0.05
                      ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10"
                      : "text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/5"
                  }`}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  <span>{z.label}</span>
                </button>
              ))}
              <div className="border-t border-[var(--fintheon-border)]/10" />
              <button
                onClick={() => {
                  onFitView?.();
                  setZoomOpen(false);
                }}
                aria-label="Fit to screen"
                title="Fit to screen"
                className="w-full text-left px-3 py-1.5 text-[10px] text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/5 transition-colors"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Fit to Screen
              </button>
              <button
                onClick={() => {
                  onResetView?.();
                  setZoomOpen(false);
                }}
                aria-label="Reset view"
                title="Reset view"
                className="w-full text-left px-3 py-1.5 text-[10px] text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/5 transition-colors"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Reset View
              </button>
              <div className="border-t border-[var(--fintheon-border)]/10 px-3 py-1">
                <span
                  className="text-[8px] text-[var(--fintheon-muted)]/30"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Cmd+/Cmd- to zoom
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
