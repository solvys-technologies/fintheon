// [claude-code 2026-03-28] S8-T2: Unified bottom bar — static toolkit + expandable command-palette chat
import { useState } from 'react';
import {
  Hand,
  MousePointer2,
  Plus,
  Download,
  Zap,
  Filter,
  Map,
  Highlighter,
  SquareDashedMousePointer,
} from 'lucide-react';
import { NarrativeCanvasChat } from './NarrativeCanvasChat';

export type CanvasTool = 'select' | 'hand' | 'multi-select' | 'highlight';

interface NarrativeFloatingToolbarProps {
  activeTool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  onAddCatalyst: () => void;
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
  { id: 'select', tool: 'select', icon: MousePointer2, tooltip: 'Select', shortcut: 'V' },
  { id: 'hand', tool: 'hand', icon: Hand, tooltip: 'Hand (pan)', shortcut: 'Space' },
  { id: 'multi', tool: 'multi-select', icon: SquareDashedMousePointer, tooltip: 'Multi-select', shortcut: 'M' },
  { id: 'highlight', tool: 'highlight', icon: Highlighter, tooltip: 'Highlight to branch', shortcut: 'H' },
];

const ACTIONS: (ToolBtn & { onClick: string })[] = [
  { id: 'add', onClick: 'add', icon: Plus, tooltip: 'Add catalyst' },
  { id: 'import', onClick: 'import', icon: Download, tooltip: 'Import from RiskFlow' },
  { id: 'heatmap', onClick: 'heatmap', icon: Map, tooltip: 'Severity heatmap' },
  { id: 'filter', onClick: 'filter', icon: Filter, tooltip: 'Filter by sentiment' },
  { id: 'sanctum', onClick: 'sanctum', icon: Zap, tooltip: 'Sanctum panel', shortcut: 'S' },
];

const ZOOM_PRESETS = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1.0 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2.0 },
];

export function NarrativeFloatingToolbar({
  activeTool,
  onToolChange,
  onAddCatalyst,
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
  pendingChips,
  onClearChip,
}: NarrativeFloatingToolbarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [sanctumOpen, setSanctumOpen] = useState(false);

  const handleAction = (id: string) => {
    switch (id) {
      case 'add': onAddCatalyst(); break;
      case 'import': onImport(); break;
      case 'sanctum': setSanctumOpen(v => !v); break;
      case 'heatmap': onToggleHeatmap(); break;
      case 'filter': onToggleFilter(); break;
    }
  };

  const isActionActive = (id: string) => {
    if (id === 'sanctum') return sanctumActive;
    if (id === 'heatmap') return heatmapActive;
    if (id === 'filter') return filterActive;
    return false;
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2">
      {/* Chat section — expandable above toolbar */}
      <NarrativeCanvasChat pendingChips={pendingChips} onClearChip={onClearChip} />

      {/* Toolbar section — static, always visible */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-xl bg-[var(--fintheon-surface)]/90 backdrop-blur-xl border border-[var(--fintheon-border)]/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      {/* Tool group */}
      {TOOLS.map(t => {
        const Icon = t.icon;
        const active = activeTool === t.tool;
        return (
          <div key={t.id} className="relative" onMouseEnter={() => setHoveredId(t.id)} onMouseLeave={() => setHoveredId(null)}>
            <button
              onClick={() => onToolChange(t.tool)}
              className={`p-2 rounded-lg transition-all duration-150 ${
                active
                  ? 'bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]'
                  : 'text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-surface)]/60'
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={active ? 2.5 : 1.5} />
            </button>
            {hoveredId === t.id && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
                <div className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-border)]/30 rounded px-2 py-1 shadow-lg whitespace-nowrap flex items-center gap-2">
                  <span className="text-[10px] text-[var(--fintheon-text)]/80">{t.tooltip}</span>
                  {t.shortcut && (
                    <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-[var(--fintheon-surface)]/60 text-[var(--fintheon-muted)]/50">{t.shortcut}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Divider */}
      <div className="w-px h-6 bg-[var(--fintheon-border)]/20 mx-0.5" />

      {/* Action group */}
      {ACTIONS.map(a => {
        const Icon = a.icon;
        const active = isActionActive(a.id);
        return (
          <div key={a.id} className="relative" onMouseEnter={() => setHoveredId(a.id)} onMouseLeave={() => setHoveredId(null)}>
            <button
              onClick={() => handleAction(a.onClick)}
              className={`p-2 rounded-lg transition-all duration-150 ${
                active || (a.id === 'sanctum' && sanctumOpen)
                  ? 'bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]'
                  : 'text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-surface)]/60'
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={active ? 2.5 : 1.5} />
            </button>
            {/* Sanctum dropdown */}
            {a.id === 'sanctum' && sanctumOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 min-w-[170px] rounded-lg border border-[var(--fintheon-border)]/20 bg-[var(--fintheon-bg)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
                {[
                  { label: 'Command Center', page: 0 },
                  { label: 'Economic Intelligence', page: 1 },
                  { label: 'Risk & Narratives', page: 2 },
                ].map(item => (
                  <button
                    key={item.page}
                    onClick={() => { onToggleSanctum(item.page); setSanctumOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-[10px] text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/5 transition-colors"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
            {hoveredId === a.id && !sanctumOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
                <div className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-border)]/30 rounded px-2 py-1 shadow-lg whitespace-nowrap flex items-center gap-2">
                  <span className="text-[10px] text-[var(--fintheon-text)]/80">{a.tooltip}</span>
                  {a.shortcut && (
                    <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-[var(--fintheon-surface)]/60 text-[var(--fintheon-muted)]/50">{a.shortcut}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Divider */}
      <div className="w-px h-6 bg-[var(--fintheon-border)]/20 mx-0.5" />

      {/* Zoom dropdown */}
      <div className="relative">
        <button
          onClick={() => setZoomOpen(v => !v)}
          className="px-2 py-1 rounded-lg text-[10px] text-[var(--fintheon-muted)]/50 hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-surface)]/60 transition-colors"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {Math.round(scale * 100)}%
        </button>
        {zoomOpen && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 min-w-[130px] rounded-lg border border-[var(--fintheon-border)]/20 bg-[var(--fintheon-bg)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
            {ZOOM_PRESETS.map(z => (
              <button
                key={z.label}
                onClick={() => { onZoomTo?.(z.value); setZoomOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-[10px] flex items-center justify-between transition-colors ${
                  Math.abs(scale - z.value) < 0.05
                    ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10'
                    : 'text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/5'
                }`}
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                <span>{z.label}</span>
              </button>
            ))}
            <div className="border-t border-[var(--fintheon-border)]/10" />
            <button
              onClick={() => { onFitView?.(); setZoomOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-[10px] text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/5 transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Fit to Screen
            </button>
            <div className="border-t border-[var(--fintheon-border)]/10 px-3 py-1">
              <span className="text-[8px] text-[var(--fintheon-muted)]/30" style={{ fontFamily: 'var(--font-mono)' }}>
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
