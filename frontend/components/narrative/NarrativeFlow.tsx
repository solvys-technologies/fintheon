// [claude-code 2026-03-28] S7: Force-directed canvas, removed Sanctum overlay (now separate view)
// [claude-code 2026-03-28] S5-T3: CatalystModal + auto-seed pipeline wired in
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNarrative } from '../../contexts/NarrativeContext';
import NarrativeForceCanvas from './NarrativeForceCanvas';
import { TimelineScrubber } from './TimelineScrubber';
import { NarrativeSaveModal } from './NarrativeSaveModal';
import { RiskFlowImportModal } from './RiskFlowImportModal';
import { NarrativeTimelineModal } from './NarrativeManageModal';
import { CatalystModal } from './CatalystModal';
import { NarrativeHighlightProvider } from './NarrativeHighlightProvider';
import { NarrativeFloatingToolbar, type CanvasTool } from './NarrativeFloatingToolbar';
import { useRiskFlow } from '../../contexts/RiskFlowContext';
import { loadSeedEvents, importRiskFlowItems } from '../../lib/narrative-seed-loader';
import type { CatalystCard } from '../../lib/narrative-types';

export function NarrativeFlow() {
  const { state, snapshot, dispatch } = useNarrative();
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [visibleLaneIds, setVisibleLaneIds] = useState<Set<string>>(() =>
    new Set(state.lanes.map(l => l.id))
  );
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [catalystModalOpen, setCatalystModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CatalystCard | null>(null);
  const [canvasTool, setCanvasTool] = useState<CanvasTool>('select');
  const [canvasScale, setCanvasScale] = useState(1.0);
  const [zoomFns, setZoomFns] = useState<{ zoomTo: (level: number) => void; fitView: () => void } | null>(null);
  const { alerts } = useRiskFlow();
  const seedLoadedRef = useRef(false);

  // Auto-seed historical events on first boot
  useEffect(() => {
    if (seedLoadedRef.current) return;
    seedLoadedRef.current = true;
    const seeds = loadSeedEvents();
    if (seeds.length > 0) {
      dispatch({ type: 'BULK_ADD_CATALYSTS', catalysts: seeds });
    }
  }, [dispatch]);

  // Auto-import top RiskFlow items as editable copies
  useEffect(() => {
    if (alerts.length === 0) return;
    const highAlerts = alerts.filter(a => a.severity === 'high' || a.severity === 'critical');
    if (highAlerts.length === 0) return;
    const existingRfIds = new Set(
      state.catalysts.filter(c => c.riskflowItemId).map(c => c.riskflowItemId!)
    );
    const imported = importRiskFlowItems(highAlerts, existingRfIds);
    if (imported.length > 0) {
      dispatch({ type: 'BULK_ADD_CATALYSTS', catalysts: imported });
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
