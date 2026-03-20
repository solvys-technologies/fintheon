// [claude-code 2026-03-16] Stone theme + narrative theme integration
// [claude-code 2026-03-16] Added Manage button for NarrativeManageModal
// [claude-code 2026-03-20] S3:T4e: Made toolbar flex-1 for full width
import { useState, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Map,
  Plus,
  RotateCcw,
  Save,
  Play,
  Filter,
  Download,
  Settings2,
  Zap,
} from 'lucide-react';
import type { NarrativeFlowState, ZoomLevel, CatalystSentiment, CatalystTemplateType } from '../../lib/narrative-types';
import { formatWeekLabel, shiftWeek } from '../../lib/narrative-time';
import { CATALYST_TEMPLATES } from '../../lib/narrative-templates';
import { CatalystTemplateMenu } from './CatalystTemplateMenu';

interface NarrativeToolbarProps {
  state: NarrativeFlowState;
  dispatch: (action: any) => void;
  onSave: () => void;
  onUndo: () => void;
  hasSnapshot: boolean;
  onImport: () => void;
  onManage: () => void;
  onMiroFish: () => void;
  mirofishActive: boolean;
}

const ZOOM_LEVELS: { value: ZoomLevel; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

const SENTIMENT_OPTIONS: { value: CatalystSentiment | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'bullish', label: 'Bullish' },
  { value: 'bearish', label: 'Bearish' },
];

export function NarrativeToolbar({ state, dispatch, onSave, onUndo, hasSnapshot, onImport, onManage, onMiroFish, mirofishActive }: NarrativeToolbarProps) {
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);

  const getAnchorPos = (ref: React.RefObject<HTMLButtonElement | null>) => {
    if (!ref.current) return { x: 0, y: 0 };
    const rect = ref.current.getBoundingClientRect();
    return { x: rect.left, y: rect.bottom + 4 };
  };

  return (
    <div className="h-12 flex-1 flex items-center justify-between px-3 border-b border-[var(--fintheon-border)]/20 bg-[var(--fintheon-surface)]">
      {/* Left group: Zoom + Navigation */}
      <div className="flex items-center gap-3">
        {/* Zoom level toggle */}
        <div className="flex items-center rounded-md border border-[var(--fintheon-border)]/20 overflow-hidden">
          {ZOOM_LEVELS.map((z) => {
            const active = state.zoomLevel === z.value;
            return (
              <button
                key={z.value}
                onClick={() => dispatch({ type: 'SET_ZOOM', level: z.value })}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)] border-r border-[var(--fintheon-accent)]/30'
                    : 'text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)] border-r border-[var(--fintheon-border)]/20'
                } last:border-r-0`}
              >
                {z.label}
              </button>
            );
          })}
        </div>

        {/* Current range label */}
        <span className="text-xs text-[var(--fintheon-muted)] font-mono min-w-[140px]">
          {formatWeekLabel(new Date(state.currentWeekStart))}
        </span>

        {/* Navigation arrows */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => {
              const prev = shiftWeek(new Date(state.currentWeekStart), -1);
              dispatch({ type: 'SET_WEEK', weekStart: prev.toISOString().slice(0, 10) });
            }}
            className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-[var(--fintheon-muted)]" />
          </button>
          <button
            onClick={() => {
              const next = shiftWeek(new Date(state.currentWeekStart), 1);
              dispatch({ type: 'SET_WEEK', weekStart: next.toISOString().slice(0, 10) });
            }}
            className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-[var(--fintheon-muted)]" />
          </button>
        </div>
      </div>

      {/* Right group: Filter, Heatmap, Template, Undo, Save, Replay */}
      <div className="flex items-center gap-1">
        {/* Filter dropdown */}
        <div className="relative">
          <button
            ref={filterBtnRef}
            onClick={() => setFilterOpen(!filterOpen)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
              state.filterSentiment !== 'all'
                ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10'
                : 'text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{SENTIMENT_OPTIONS.find((s) => s.value === state.filterSentiment)?.label ?? 'All'}</span>
          </button>
          {filterOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--fintheon-surface)]/95 backdrop-blur-lg border border-[var(--fintheon-border)]/30 rounded-lg shadow-xl py-1 min-w-[100px] animate-fade-in">
              {SENTIMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    dispatch({
                      type: 'SET_FILTER',
                      sentiment: opt.value,
                    });
                    setFilterOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    state.filterSentiment === opt.value
                      ? 'text-[var(--fintheon-accent)]'
                      : 'text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Heatmap toggle */}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_HEATMAP' })}
          className={`p-1.5 rounded transition-colors ${
            state.heatmapEnabled
              ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10'
              : 'text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]'
          }`}
          title="Toggle heatmap"
        >
          <Map className="w-3.5 h-3.5" />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-[var(--fintheon-border)]/20 mx-1" />

        {/* Add template */}
        <button
          ref={addBtnRef}
          onClick={() => setTemplateMenuOpen(!templateMenuOpen)}
          className="p-1.5 rounded text-[var(--fintheon-muted)] hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
          title="Add catalyst"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        <CatalystTemplateMenu
          open={templateMenuOpen}
          onClose={() => setTemplateMenuOpen(false)}
          onSelect={(templateType: CatalystTemplateType) => {
            const tpl = CATALYST_TEMPLATES.find((t) => t.type === templateType);
            if (!tpl) return;
            dispatch({
              type: 'ADD_CATALYST',
              catalyst: {
                title: tpl.defaultTitle,
                description: tpl.description,
                date: state.currentWeekStart,
                sentiment: 'bullish' as const,
                severity: tpl.defaultSeverity,
                source: 'user' as const,
                narrativeIds: [],
                isGhost: false,
                templateType,
                position: null,
              },
            });
          }}
          anchorPosition={getAnchorPos(addBtnRef)}
        />

        {/* Import from RiskFlow */}
        <button
          onClick={onImport}
          className="p-1.5 rounded text-[var(--fintheon-muted)] hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
          title="Import catalysts from RiskFlow"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        {/* Manage */}
        <button
          onClick={onManage}
          className="p-1.5 rounded text-[var(--fintheon-muted)] hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
          title="Manage narratives"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>

        {/* MiroFish Auditorium */}
        <button
          onClick={onMiroFish}
          className={`p-1.5 rounded transition-colors ${
            mirofishActive
              ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10'
              : 'text-[var(--fintheon-muted)] hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10'
          }`}
          title="MiroFish Auditorium"
        >
          <Zap className="w-3.5 h-3.5" />
        </button>

        {/* Undo */}
        <button
          onClick={onUndo}
          disabled={!hasSnapshot}
          className="p-1.5 rounded transition-colors disabled:opacity-30 text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/10"
          title="Undo"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Save */}
        <button
          onClick={onSave}
          className="p-1.5 rounded text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
          title="Save"
        >
          <Save className="w-3.5 h-3.5" />
        </button>

        {/* Replay */}
        <button
          onClick={() =>
            dispatch({ type: 'SET_REPLAY_MODE', enabled: !state.replayMode })
          }
          className={`p-1.5 rounded transition-colors ${
            state.replayMode
              ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10'
              : 'text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]'
          }`}
          title={state.replayMode ? 'Stop replay' : 'Start replay'}
        >
          <Play className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
