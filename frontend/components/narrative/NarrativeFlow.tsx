// [claude-code 2026-03-16] Stone theme + narrative theme integration
// [claude-code 2026-03-16] Wired NarrativeManageModal and tag filter state
// [claude-code 2026-03-16] MiroFish Auditorium split view + context menu + add modal
import { useState, useCallback, useMemo } from 'react';
import { useNarrative } from '../../contexts/NarrativeContext';
import { NarrativeToolbar } from './NarrativeToolbar';
import NarrativeWeekView from './NarrativeWeekView';
import { NarrativeCanvas } from './NarrativeCanvas';
import { NarrativeDropdown } from './NarrativeDropdown';
import { TimelineScrubber } from './TimelineScrubber';
import { NarrativeSaveModal } from './NarrativeSaveModal';
import { RiskFlowImportModal } from './RiskFlowImportModal';
import { NarrativeTimelineModal } from './NarrativeManageModal';
import { Auditorium } from './Auditorium';
import { NarrativeContextMenu, type ContextMenuTarget } from './NarrativeContextMenu';
import { AddNarrativeModal } from './AddNarrativeModal';
import type { AuditoriumData } from '../../types/mirofish';
import type { NarrativeLane } from '../../lib/narrative-types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export function NarrativeFlow() {
  const { state, snapshot, dispatch } = useNarrative();
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [visibleLaneIds, setVisibleLaneIds] = useState<Set<string>>(() =>
    new Set(state.lanes.map(l => l.id))
  );
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [auditoriumOpen, setAuditoriumOpen] = useState(false);
  const [mirofishData, setMirofishData] = useState<AuditoriumData | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null);
  // Add/Edit modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editLane, setEditLane] = useState<NarrativeLane | null>(null);

  const handleSave = useCallback(() => { setSaveModalOpen(true); }, []);
  const handleConfirmSave = useCallback(() => { dispatch({ type: 'TAKE_SNAPSHOT' }); setSaveModalOpen(false); }, [dispatch]);
  const handleImportCatalysts = useCallback((catalysts: any[]) => { dispatch({ type: 'IMPORT_CATALYSTS', catalysts }); }, [dispatch]);
  const handleUndo = useCallback(() => { if (snapshot) dispatch({ type: 'RESTORE_SNAPSHOT' }); }, [snapshot, dispatch]);

  const handleToggleLane = useCallback((id: string) => {
    setVisibleLaneIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }, []);
  const handleSelectAll = useCallback(() => { setVisibleLaneIds(new Set(state.lanes.map(l => l.id))); }, [state.lanes]);
  const handleClearAll = useCallback(() => { setVisibleLaneIds(new Set()); }, []);
  const handleToggleTag = useCallback((tag: string) => {
    setActiveTags(prev => { const next = new Set(prev); next.has(tag) ? next.delete(tag) : next.add(tag); return next; });
  }, []);

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, id: string, type: 'lane' | 'catalyst' = 'lane') => {
    e.preventDefault();
    setContextMenu({ type, id, x: e.clientX, y: e.clientY });
  }, []);

  const handleRename = useCallback((id: string) => {
    const lane = state.lanes.find(l => l.id === id);
    if (!lane) return;
    const newTitle = window.prompt('Rename narrative:', lane.title);
    if (newTitle && newTitle.trim()) {
      dispatch({ type: 'UPDATE_LANE', id, updates: { title: newTitle.trim() } });
    }
  }, [state.lanes, dispatch]);

  const handleDelete = useCallback((id: string) => {
    if (contextMenu?.type === 'catalyst') {
      dispatch({ type: 'REMOVE_CATALYST', id });
    } else {
      const lane = state.lanes.find(l => l.id === id);
      if (lane && window.confirm(`Delete "${lane.title}"? This cannot be undone.`)) {
        dispatch({ type: 'REMOVE_LANE', id });
      }
    }
  }, [contextMenu, state.lanes, dispatch]);

  const handleArchive = useCallback((id: string) => {
    const lane = state.lanes.find(l => l.id === id);
    if (!lane) return;
    dispatch({ type: 'UPDATE_LANE', id, updates: { status: lane.status === 'archived' ? 'active' : 'archived' } });
  }, [state.lanes, dispatch]);

  const handleFork = useCallback((id: string) => {
    const lane = state.lanes.find(l => l.id === id);
    if (!lane) return;
    const title = window.prompt('Fork title:', `${lane.title} (fork)`);
    if (title?.trim()) dispatch({ type: 'FORK_LANE', laneId: id, title: title.trim() });
  }, [state.lanes, dispatch]);

  const handleAskAI = useCallback((id: string) => {
    // Placeholder — could open chat with context
    console.log('[NarrativeFlow] Ask AI about:', id);
  }, []);

  const handleEdit = useCallback((id: string) => {
    if (contextMenu?.type === 'lane') {
      const lane = state.lanes.find(l => l.id === id);
      if (lane) { setEditLane(lane); setAddModalOpen(true); }
    }
  }, [contextMenu, state.lanes]);

  const handleSetStatus = useCallback((id: string, status: any) => {
    dispatch({ type: 'UPDATE_LANE', id, updates: { status } });
  }, [dispatch]);

  const handleSetDirection = useCallback((id: string, directionBias: any) => {
    dispatch({ type: 'UPDATE_LANE', id, updates: { directionBias } });
  }, [dispatch]);

  const handleAddNarrative = useCallback(() => {
    setEditLane(null);
    setAddModalOpen(true);
  }, []);

  const handleSubmitNarrative = useCallback((lane: Omit<NarrativeLane, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editLane) {
      dispatch({ type: 'UPDATE_LANE', id: editLane.id, updates: lane });
    } else {
      dispatch({ type: 'ADD_LANE', lane: { ...lane, order: state.lanes.length } });
    }
  }, [editLane, state.lanes.length, dispatch]);

  // MiroFish
  const handleRunMiroFish = useCallback(async () => {
    setMirofishData(prev => prev
      ? { ...prev, status: 'running' }
      : { simulationId: '', status: 'running', compositeIV: 0, confidence: 0, regimeShiftProbability: 0, categoryScores: [], timeSeries: [], generatedEvents: [], scenarios: [] }
    );
    try {
      const narrativeState = {
        lanes: state.lanes.map(l => ({
          id: l.id, title: l.title, instruments: l.instruments,
          directionBias: l.directionBias, category: l.category,
          status: l.status, healthScore: l.healthScore, dateRange: l.dateRange,
        })),
        catalysts: state.catalysts.map(c => ({
          id: c.id, title: c.title, description: c.description ?? '',
          date: c.date, sentiment: c.sentiment, severity: c.severity,
          narrativeIds: c.narrativeIds ?? [],
        })),
        ropes: (state.ropes ?? []).map(r => ({
          id: r.id, fromId: r.fromId, toId: r.toId, polarity: r.polarity, weight: r.weight,
        })),
      };
      const simRes = await fetch(`${API_BASE}/api/mirofish/simulate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ narrativeState }),
      });
      if (!simRes.ok) throw new Error(`Simulation failed: ${simRes.status}`);
      const { simulationId } = await simRes.json();
      const reportRes = await fetch(`${API_BASE}/api/mirofish/report/${simulationId}`);
      if (!reportRes.ok) throw new Error(`Report fetch failed: ${reportRes.status}`);
      const report = await reportRes.json();
      setMirofishData({
        simulationId, status: 'complete',
        compositeIV: report.nextSessionScore ?? 5, confidence: report.confidence ?? 0.5,
        regimeShiftProbability: report.regimeShiftProbability ?? 0.1,
        categoryScores: report.categoryScores ?? [], timeSeries: report.timeSeries ?? [],
        generatedEvents: report.generatedEvents ?? [], scenarios: report.scenarios ?? [],
      });
    } catch (err) {
      console.error('[MiroFish] Run failed:', err);
      setMirofishData(prev => prev ? { ...prev, status: 'error', error: err instanceof Error ? err.message : 'Unknown error' } : null);
    }
  }, [state]);

  const isCanvasView = state.zoomLevel !== 'week';

  const catalystsForKanban = useMemo(() =>
    state.catalysts.map(c => ({
      id: c.id, title: c.title, date: c.date, sentiment: c.sentiment, severity: c.severity,
      category: c.narrativeIds?.[0] ? state.lanes.find(l => l.id === c.narrativeIds[0])?.category : undefined,
    })),
    [state.catalysts, state.lanes],
  );

  const contextLane = contextMenu?.type === 'lane'
    ? state.lanes.find(l => l.id === contextMenu.id)
    : undefined;

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--fintheon-bg)' }}>
      <div className="flex items-center">
        <NarrativeToolbar
          state={state}
          dispatch={dispatch}
          onSave={handleSave}
          onUndo={handleUndo}
          hasSnapshot={!!snapshot}
          onImport={() => setImportModalOpen(true)}
          onManage={() => setManageModalOpen(true)}
          onMiroFish={() => setAuditoriumOpen(!auditoriumOpen)}
          mirofishActive={auditoriumOpen}
          onAddNarrative={handleAddNarrative}
        />
        {isCanvasView && (
          <div className="pr-2 shrink-0">
            <NarrativeDropdown
              visibleLaneIds={visibleLaneIds}
              onToggleLane={handleToggleLane}
              onSelectAll={handleSelectAll}
              onClearAll={handleClearAll}
              activeTags={activeTags}
              onToggleTag={handleToggleTag}
            />
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 relative overflow-hidden flex">
        <div className={auditoriumOpen ? 'w-[60%]' : 'w-full'} style={{ transition: 'width 0.3s ease' }}>
          {isCanvasView ? (
            <NarrativeCanvas visibleLaneIds={visibleLaneIds} />
          ) : (
            <NarrativeWeekView onContextMenuLane={handleContextMenu} />
          )}
        </div>
        {auditoriumOpen && (
          <Auditorium data={mirofishData} onRun={handleRunMiroFish} catalysts={catalystsForKanban} />
        )}
      </div>

      <TimelineScrubber state={state} catalysts={state.catalysts} dispatch={dispatch} />

      {/* Modals */}
      <NarrativeSaveModal open={saveModalOpen} onConfirm={handleConfirmSave} onCancel={() => setSaveModalOpen(false)} />
      <RiskFlowImportModal open={importModalOpen} onClose={() => setImportModalOpen(false)} onImport={handleImportCatalysts} lanes={state.lanes} />
      <NarrativeTimelineModal open={manageModalOpen} onClose={() => setManageModalOpen(false)} />
      <AddNarrativeModal
        open={addModalOpen}
        onClose={() => { setAddModalOpen(false); setEditLane(null); }}
        onSubmit={handleSubmitNarrative}
        editLane={editLane}
      />

      {/* Context menu */}
      {contextMenu && (
        <NarrativeContextMenu
          target={contextMenu}
          lane={contextLane}
          onClose={() => setContextMenu(null)}
          onRename={handleRename}
          onDelete={handleDelete}
          onArchive={handleArchive}
          onSetStatus={handleSetStatus}
          onSetDirection={handleSetDirection}
          onFork={handleFork}
          onAskAI={handleAskAI}
          onEdit={handleEdit}
        />
      )}
    </div>
  );
}
