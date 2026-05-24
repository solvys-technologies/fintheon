// [claude-code 2026-03-28] Refactored toolbar with hover descriptions, canvas interaction hints
// [claude-code 2026-03-27] S4-T2: Updated zoom controls with read-only indicators for quarter/year
import { useState, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Map,
  Plus,
  RotateCcw,
  Save,
  Play,
  Filter,
  Download,
  Settings2,
  Zap,
  Highlighter,
  Move,
} from "lucide-react";
import type {
  NarrativeFlowState,
  ZoomLevel,
  CatalystSentiment,
  CatalystTemplateType,
} from "../../lib/narrative-types";
import { formatWeekLabel, shiftWeek } from "../../lib/narrative-time";
import { CATALYST_TEMPLATES } from "../../lib/narrative-templates";
import { CatalystTemplateMenu } from "./CatalystTemplateMenu";
import { useHighlight } from "./NarrativeHighlightProvider";

interface NarrativeToolbarProps {
  state: NarrativeFlowState;
  dispatch: (action: any) => void;
  onSave: () => void;
  onUndo: () => void;
  hasSnapshot: boolean;
  onImport: () => void;
  onManage: () => void;
  onAgentDesk: () => void;
  agentDeskActive: boolean;
}

const ZOOM_LEVELS: { value: ZoomLevel; label: string; hint: string }[] = [
  { value: "week", label: "W", hint: "Week view — individual cards" },
  { value: "month", label: "M", hint: "Month view — weekly aggregates" },
  {
    value: "quarter",
    label: "Q",
    hint: "Quarter view — monthly aggregates (read-only)",
  },
  {
    value: "year",
    label: "Y",
    hint: "Year view — quarterly aggregates (read-only)",
  },
];

const SENTIMENT_OPTIONS: { value: CatalystSentiment | "all"; label: string }[] =
  [
    { value: "all", label: "All" },
    { value: "bullish", label: "Bullish" },
    { value: "bearish", label: "Bearish" },
  ];

/** Toolbar icon button with hover tooltip */
function ToolbarBtn({
  onClick,
  active,
  disabled,
  tooltip,
  shortcut,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tooltip: string;
  shortcut?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`p-1.5 rounded transition-colors ${
          disabled
            ? "opacity-30 cursor-not-allowed"
            : active
              ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10"
              : "text-[var(--fintheon-muted)] hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10"
        }`}
      >
        {children}
      </button>
      {/* Hover tooltip */}
      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
        <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-border)]/30 rounded px-2.5 py-1.5 shadow-lg whitespace-nowrap">
          <span className="text-[10px] text-[var(--fintheon-text)]/80">
            {tooltip}
          </span>
          {shortcut && (
            <span className="text-[9px] text-[var(--fintheon-muted)]/40 ml-2 font-mono">
              {shortcut}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function NarrativeToolbar({
  state,
  dispatch,
  onSave,
  onUndo,
  hasSnapshot,
  onImport,
  onManage,
  onAgentDesk,
  agentDeskActive,
}: NarrativeToolbarProps) {
  const { highlightMode, toggleHighlightMode } = useHighlight();
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const getAnchorPos = (ref: React.RefObject<HTMLButtonElement | null>) => {
    if (!ref.current) return { x: 0, y: 0 };
    const rect = ref.current.getBoundingClientRect();
    return { x: rect.left, y: rect.bottom + 4 };
  };

  return (
    <div className="h-10 flex-1 flex items-center justify-between px-3 border-b border-[var(--fintheon-border)]/20 bg-[var(--fintheon-bg)]">
      {/* Left: Zoom + Navigation */}
      <div className="flex items-center gap-2">
        {/* Zoom level pills */}
        <div className="flex items-center rounded border border-[var(--fintheon-border)]/20 overflow-hidden">
          {ZOOM_LEVELS.map((z, i) => {
            const active = state.zoomLevel === z.value;
            const isReadOnly = z.value === "quarter" || z.value === "year";
            const showSep = i === 2;
            return (
              <div key={z.value} className="relative group flex items-center">
                {showSep && (
                  <div className="w-px h-3 bg-[var(--fintheon-border)]/30" />
                )}
                <button
                  onClick={() => dispatch({ type: "SET_ZOOM", level: z.value })}
                  className={`flex items-center gap-0.5 px-2 py-1 text-[10px] font-mono font-medium transition-colors ${
                    active
                      ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/8"
                      : "text-[var(--fintheon-muted)]/50 hover:text-[var(--fintheon-text)]"
                  }`}
                >
                  {z.label}
                  {isReadOnly && <Lock className="w-2 h-2 opacity-40" />}
                </button>
                {/* Zoom tooltip */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
                  <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-border)]/30 rounded px-2 py-1 shadow-lg whitespace-nowrap">
                    <span className="text-[9px] text-[var(--fintheon-text)]/70">
                      {z.hint}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Nav arrows + week label */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => {
              const prev = shiftWeek(new Date(state.currentWeekStart), -1);
              dispatch({
                type: "SET_WEEK",
                weekStart: prev.toISOString().slice(0, 10),
              });
            }}
            className="p-0.5 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors"
            title="Previous week"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-[var(--fintheon-muted)]/50" />
          </button>
          <span className="text-[10px] text-[var(--fintheon-muted)]/60 font-mono min-w-[110px] text-center">
            {formatWeekLabel(new Date(state.currentWeekStart))}
          </span>
          <button
            onClick={() => {
              const next = shiftWeek(new Date(state.currentWeekStart), 1);
              dispatch({
                type: "SET_WEEK",
                weekStart: next.toISOString().slice(0, 10),
              });
            }}
            className="p-0.5 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors"
            title="Next week"
          >
            <ChevronRight className="w-3.5 h-3.5 text-[var(--fintheon-muted)]/50" />
          </button>
        </div>

        {/* Canvas hint */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--fintheon-surface)]/30">
          <Move className="w-3 h-3 text-[var(--fintheon-muted)]/30" />
          <span className="text-[8px] text-[var(--fintheon-muted)]/30 font-mono">
            Hold Space to pan
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-0.5">
        {/* Highlight mode */}
        <ToolbarBtn
          onClick={toggleHighlightMode}
          active={highlightMode}
          tooltip={
            highlightMode
              ? "Exit highlight mode"
              : "Select text on cards to branch into sub-topics"
          }
          shortcut="H"
        >
          <Highlighter className="w-3.5 h-3.5" />
        </ToolbarBtn>

        {/* Filter */}
        <div className="relative">
          <ToolbarBtn
            onClick={() => setFilterOpen(!filterOpen)}
            active={state.filterSentiment !== "all"}
            tooltip="Filter cards by sentiment (Bullish / Bearish)"
          >
            <Filter className="w-3.5 h-3.5" />
          </ToolbarBtn>
          {filterOpen && (
            <div className="fintheon-dropdown-surface absolute right-0 top-full mt-1 z-50 bg-[var(--fintheon-surface)]/95 backdrop-blur-lg border border-[var(--fintheon-border)]/30 rounded-lg shadow-xl py-1 min-w-[100px]">
              {SENTIMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    dispatch({ type: "SET_FILTER", sentiment: opt.value });
                    setFilterOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    state.filterSentiment === opt.value
                      ? "text-[var(--fintheon-accent)]"
                      : "text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/5"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Heatmap */}
        <ToolbarBtn
          onClick={() => dispatch({ type: "TOGGLE_HEATMAP" })}
          active={state.heatmapEnabled}
          tooltip="Toggle severity heatmap overlay on the grid"
        >
          <Map className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 bg-[var(--fintheon-border)]/15 mx-0.5" />

        {/* Add catalyst */}
        <div className="relative">
          <div className="group relative">
            <button
              ref={addBtnRef}
              onClick={() => setTemplateMenuOpen(!templateMenuOpen)}
              className="p-1.5 rounded text-[var(--fintheon-muted)] hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
              <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-border)]/30 rounded px-2.5 py-1.5 shadow-lg whitespace-nowrap">
                <span className="text-[10px] text-[var(--fintheon-text)]/80">
                  Add catalyst from template (FOMC, CPI, Earnings...)
                </span>
              </div>
            </div>
          </div>
          <CatalystTemplateMenu
            open={templateMenuOpen}
            onClose={() => setTemplateMenuOpen(false)}
            onSelect={(templateType: CatalystTemplateType) => {
              const tpl = CATALYST_TEMPLATES.find(
                (t) => t.type === templateType,
              );
              if (!tpl) return;
              const templateCategoryMap: Record<string, string> = {
                fomc: "monetary",
                cpi: "macroeconomic",
                earnings: "earnings",
                geopolitical: "geopolitical",
                custom: "macroeconomic",
              };
              dispatch({
                type: "ADD_CATALYST",
                catalyst: {
                  title: tpl.defaultTitle,
                  description: tpl.description,
                  date: state.currentWeekStart,
                  sentiment: "bullish" as const,
                  severity: tpl.defaultSeverity,
                  source: "user" as const,
                  narrativeIds: [],
                  isGhost: false,
                  templateType,
                  position: null,
                  category: (templateCategoryMap[templateType] ??
                    "macroeconomic") as any,
                },
              });
            }}
            anchorPosition={getAnchorPos(addBtnRef)}
          />
        </div>

        {/* Import from RiskFlow */}
        <ToolbarBtn
          onClick={onImport}
          tooltip="Import scored headlines from RiskFlow feed"
        >
          <Download className="w-3.5 h-3.5" />
        </ToolbarBtn>

        {/* Manage */}
        <ToolbarBtn
          onClick={onManage}
          tooltip="Edit narrative lanes, catalysts, and timeline"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </ToolbarBtn>

        {/* Sanctum */}
        <ToolbarBtn
          onClick={onAgentDesk}
          active={agentDeskActive}
          tooltip="Open Sanctum — market intelligence panel"
          shortcut="S"
        >
          <Zap className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 bg-[var(--fintheon-border)]/15 mx-0.5" />

        {/* Undo */}
        <ToolbarBtn
          onClick={onUndo}
          disabled={!hasSnapshot}
          tooltip="Undo last change"
          shortcut="Cmd+Z"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </ToolbarBtn>

        {/* Save */}
        <ToolbarBtn
          onClick={onSave}
          tooltip="Save current state as snapshot"
          shortcut="Cmd+S"
        >
          <Save className="w-3.5 h-3.5" />
        </ToolbarBtn>

        {/* Replay */}
        <ToolbarBtn
          onClick={() =>
            dispatch({ type: "SET_REPLAY_MODE", enabled: !state.replayMode })
          }
          active={state.replayMode}
          tooltip={
            state.replayMode
              ? "Stop timeline replay"
              : "Replay the narrative timeline"
          }
        >
          <Play className="w-3.5 h-3.5" />
        </ToolbarBtn>
      </div>
    </div>
  );
}
