// [claude-code 2026-03-30] Added narrative visibility filter dropdown in top-right of canvas
// [claude-code 2026-03-30] Unified data: seed events + RiskFlow alerts both load into NarrativeContext
// [claude-code 2026-03-29] Catalysts sourced from DB via RiskFlowContext — seed JSON and localStorage import removed
// [claude-code 2026-03-28] S7: Force-directed canvas, removed Sanctum overlay (now separate view)
// [claude-code 2026-03-28] S5-T3: CatalystModal + auto-seed pipeline wired in
import { useState, useCallback, useEffect, useRef } from 'react';
import { Eye, EyeOff, ChevronDown } from 'lucide-react';
import { useNarrative } from '../../contexts/NarrativeContext';
import NarrativeForceCanvas from './NarrativeForceCanvas';
import { TimelineScrubber } from './TimelineScrubber';
import { NarrativeSaveModal } from './NarrativeSaveModal';
import { RiskFlowImportModal } from './RiskFlowImportModal';
import { NarrativeTimelineModal } from './NarrativeManageModal';
import { CatalystModal } from './CatalystModal';
import { NarrativeHighlightProvider } from './NarrativeHighlightProvider';
import { NarrativeFloatingToolbar, type CanvasTool } from './NarrativeFloatingToolbar';
import { NarrativeCanvasChat } from './NarrativeCanvasChat';
import { useRiskFlow } from '../../contexts/RiskFlowContext';
import { loadSeedEvents, alertToCatalyst } from '../../lib/narrative-seed-loader';
import type { CatalystCard } from '../../lib/narrative-types';

export function NarrativeMap() {
  const { state, snapshot, dispatch } = useNarrative();
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  // Empty set = show all narratives (canvas checks size === 0 → show all)
  const [visibleLaneIds, setVisibleLaneIds] = useState<Set<string>>(new Set());
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [catalystModalOpen, setCatalystModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CatalystCard | null>(null);
  const [canvasTool, setCanvasTool] = useState<CanvasTool>('select');
  const [canvasScale, setCanvasScale] = useState(1.0);
  const [zoomFns, setZoomFns] = useState<{ zoomTo: (level: number) => void; fitView: () => void } | null>(null);
  const { alerts } = useRiskFlow();
  const seedLoadedRef = useRef(false);

  // Load historical seed events on first boot (513 pre-classified catalysts)
  useEffect(() => {
    if (seedLoadedRef.current) return;
    seedLoadedRef.current = true;
    const seedCards = loadSeedEvents();
    if (seedCards.length > 0) {
      dispatch({ type: 'BULK_ADD_CATALYSTS', catalysts: seedCards });
    }
  }, [dispatch]);

  // Sync ALL RiskFlow items as catalyst cards with keyword-based narrative classification
  useEffect(() => {
    if (alerts.length === 0) return;
    const existingRfIds = new Set(
      state.catalysts.filter(c => c.riskflowItemId).map(c => c.riskflowItemId!)
    );
    const newCards = alerts
      .filter(a => !existingRfIds.has(a.id))
      .map(alertToCatalyst);
    if (newCards.length > 0) {
      dispatch({ type: 'BULK_ADD_CATALYSTS', catalysts: newCards });
    }
  }, [alerts, state.catalysts, dispatch]);

  const handleSave = useCallback(() => {
    setSaveModalOpen(true);
  }, []);

  const handleConfirmSave = useCallback(() => {
    dispatch({ type: 'TAKE_SNAPSHOT' });
    setSaveModalOpen(false);
  }, [dispatch]);

  const handleImportCatalysts = useCallback((catalysts: any[]) => {
    dispatch({ type: 'IMPORT_CATALYSTS', catalysts });
  }, [dispatch]);

  const handleUndo = useCallback(() => {
    if (snapshot) {
      dispatch({ type: 'RESTORE_SNAPSHOT' });
    }
  }, [snapshot, dispatch]);

  const handleToggleLane = useCallback((id: string) => {
    setVisibleLaneIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setVisibleLaneIds(new Set(state.lanes.map(l => l.id)));
  }, [state.lanes]);

  const handleClearAll = useCallback(() => {
    setVisibleLaneIds(new Set());
  }, []);

  const handleToggleTag = useCallback((tag: string) => {
    setActiveTags(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }, []);

  const handleSelectCard = useCallback((_id: string) => {
    // Selection is visual-only, handled inside the force canvas
  }, []);

  const handleEditCard = useCallback((card: CatalystCard) => {
    setEditingCard(card);
    setCatalystModalOpen(true);
  }, []);

  return (
    <NarrativeHighlightProvider>
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--fintheon-bg)' }}>
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {/* Force-directed mind map canvas */}
        <NarrativeForceCanvas
          visibleLaneIds={visibleLaneIds}
          activeTags={activeTags}
          activeTool={canvasTool}
          onScaleChange={setCanvasScale}
          onSelectCard={handleSelectCard}
          onEditCard={handleEditCard}
          onZoomFnsReady={setZoomFns}
        />

        {/* Narrative visibility filter — top right */}
        <NarrativeFilterDropdown
          visibleLaneIds={visibleLaneIds}
          onToggleLane={handleToggleLane}
          onSelectAll={handleSelectAll}
          onClearAll={handleClearAll}
          catalysts={state.catalysts}
        />

        {/* Canvas command palette — ephemeral chat above toolbar */}
        <NarrativeCanvasChat />

        {/* Figma-style floating toolbar — bottom center */}
        <NarrativeFloatingToolbar
          activeTool={canvasTool}
          onToolChange={setCanvasTool}
          onAddCatalyst={() => { setCatalystModalOpen(true); setEditingCard(null); }}
          onImport={() => setImportModalOpen(true)}
          onToggleSanctum={() => {/* Aquarium is now a separate view */}}
          onToggleHeatmap={() => dispatch({ type: 'TOGGLE_HEATMAP' })}
          onToggleFilter={() => {
            const next = state.filterSentiment === 'all' ? 'bearish' : state.filterSentiment === 'bearish' ? 'bullish' : 'all';
            dispatch({ type: 'SET_FILTER', sentiment: next });
          }}
          sanctumActive={false}
          heatmapActive={state.heatmapEnabled}
          filterActive={state.filterSentiment !== 'all'}
          scale={canvasScale}
          onZoomTo={zoomFns?.zoomTo}
          onFitView={zoomFns?.fitView}
        />
      </div>

      <TimelineScrubber
        state={state}
        catalysts={state.catalysts}
        dispatch={dispatch}
      />

      <NarrativeSaveModal
        open={saveModalOpen}
        onConfirm={handleConfirmSave}
        onCancel={() => setSaveModalOpen(false)}
      />

      <RiskFlowImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportCatalysts}
        lanes={state.lanes}
      />

      <NarrativeTimelineModal
        open={manageModalOpen}
        onClose={() => setManageModalOpen(false)}
      />

      <CatalystModal
        open={catalystModalOpen}
        onClose={() => { setCatalystModalOpen(false); setEditingCard(null); }}
        editCard={editingCard}
      />
    </div>
    </NarrativeHighlightProvider>
  );
}

// ── Narrative Visibility Filter Dropdown ──────────────────────────
const NARRATIVE_THREADS = [
  { slug: 'middle-east-conflict', title: 'Middle Eastern Conflict', color: '#F59E0B', shortTitle: 'Middle East' },
  { slug: 'liquidity-credit-contraction', title: 'Liquidity & Credit', color: '#8B5CF6', shortTitle: 'Liquidity' },
  { slug: 'ai-singularity', title: 'The Singularity', color: '#3B82F6', shortTitle: 'AI' },
  { slug: 'usd-jpy-carry-trade', title: 'USD-JPY Carry Trade', color: '#EC4899', shortTitle: 'Carry Trade' },
  { slug: 'trade-war', title: 'Trade War', color: '#EF4444', shortTitle: 'Trade War' },
  { slug: 'us-china-relations', title: 'US-China Relations', color: '#14B8A6', shortTitle: 'US-China' },
  { slug: 'rate-cut-cycle', title: 'Rate Cut Cycle', color: '#34D399', shortTitle: 'Rate Cuts' },
  { slug: 'trump-presidency', title: 'Trump Presidency', color: '#F97316', shortTitle: 'Trump' },
  { slug: 'price-stability', title: 'Price Stability', color: '#FBBF24', shortTitle: 'Inflation' },
  { slug: 'maximum-employment', title: 'Max Employment', color: '#A78BFA', shortTitle: 'Employment' },
] as const;

function NarrativeFilterDropdown({
  visibleLaneIds,
  onToggleLane,
  onSelectAll,
  onClearAll,
  catalysts,
}: {
  visibleLaneIds: Set<string>;
  onToggleLane: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  catalysts: CatalystCard[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Count catalysts per thread
  const countByThread = new Map<string, number>();
  for (const c of catalysts) {
    const slug = c.narrative ?? c.narrativeThreads?.[0];
    if (slug) countByThread.set(slug, (countByThread.get(slug) ?? 0) + 1);
  }

  const showAll = visibleLaneIds.size === 0;
  const hiddenCount = showAll ? 0 : NARRATIVE_THREADS.length - visibleLaneIds.size;

  return (
    <div ref={ref} className="absolute top-3 right-3 z-40">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border backdrop-blur-xl transition-all text-[11px] uppercase tracking-wider ${
          hiddenCount > 0
            ? 'border-[var(--fintheon-accent)]/30 bg-[var(--fintheon-accent)]/8 text-[var(--fintheon-accent)]'
            : 'border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)]/80 text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-text)]/80'
        }`}
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        {hiddenCount > 0 ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        {hiddenCount > 0 ? `${hiddenCount} hidden` : 'Narratives'}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-72 rounded-xl border bg-[var(--fintheon-bg)] shadow-2xl overflow-hidden"
          style={{ borderColor: 'color-mix(in srgb, var(--fintheon-accent) 20%, transparent)' }}>
          {/* Header with Select All / Clear All */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--fintheon-accent)]/10">
            <span className="text-[10px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>
              Show / Hide Narratives
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { onClearAll(); }}
                className="text-[9px] text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] transition-colors"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                All
              </button>
              <span className="text-[var(--fintheon-muted)]/20">|</span>
              <button
                onClick={onSelectAll}
                className="text-[9px] text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] transition-colors"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                None
              </button>
            </div>
          </div>

          {/* Narrative toggles */}
          <div className="py-1.5 max-h-80 overflow-y-auto">
            {NARRATIVE_THREADS.map(thread => {
              const isVisible = showAll || visibleLaneIds.has(thread.slug);
              const count = countByThread.get(thread.slug) ?? 0;
              return (
                <button
                  key={thread.slug}
                  onClick={() => onToggleLane(thread.slug)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-all duration-150 ${
                    isVisible
                      ? 'hover:bg-[var(--fintheon-accent)]/3'
                      : 'opacity-35 hover:opacity-60'
                  }`}
                >
                  {/* Color dot + visibility indicator */}
                  <div className="relative">
                    <div
                      className="w-3 h-3 rounded-sm transition-opacity"
                      style={{ backgroundColor: thread.color, opacity: isVisible ? 1 : 0.3 }}
                    />
                    {!isVisible && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-full h-px bg-[var(--fintheon-text)]/40 rotate-45" />
                      </div>
                    )}
                  </div>

                  {/* Thread name */}
                  <span
                    className={`flex-1 text-[12px] font-medium transition-colors ${
                      isVisible ? 'text-[var(--fintheon-text)]/80' : 'text-[var(--fintheon-muted)]/40'
                    }`}
                    style={{ fontFamily: 'var(--font-body)', color: isVisible ? thread.color : undefined }}
                  >
                    {thread.title}
                  </span>

                  {/* Count */}
                  <span className="text-[10px] text-[var(--fintheon-muted)]/40" style={{ fontFamily: 'var(--font-mono)' }}>
                    {count}
                  </span>

                  {/* Eye icon */}
                  {isVisible
                    ? <Eye className="w-3.5 h-3.5 text-[var(--fintheon-muted)]/30" />
                    : <EyeOff className="w-3.5 h-3.5 text-[var(--fintheon-muted)]/20" />
                  }
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
