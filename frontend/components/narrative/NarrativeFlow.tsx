// [claude-code 2026-03-16] Stone theme + narrative theme integration
import { useState, useCallback, useMemo } from 'react';
import { useNarrative } from '../../contexts/NarrativeContext';
import { NarrativeToolbar } from './NarrativeToolbar';
import NarrativeWeekView from './NarrativeWeekView';
import { NarrativeCanvas } from './NarrativeCanvas';
import { NarrativeDropdown } from './NarrativeDropdown';
import { TimelineScrubber } from './TimelineScrubber';
import { NarrativeSaveModal } from './NarrativeSaveModal';
import { RiskFlowImportModal } from './RiskFlowImportModal';

export function NarrativeFlow() {
  const { state, snapshot, dispatch } = useNarrative();
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [visibleLaneIds, setVisibleLaneIds] = useState<Set<string>>(() =>
    new Set(state.lanes.map(l => l.id))
  );

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

  const isCanvasView = state.zoomLevel !== 'week';

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--fintheon-bg)' }}>
      <div className="flex items-center gap-2">
        <NarrativeToolbar
          state={state}
          dispatch={dispatch}
          onSave={handleSave}
          onUndo={handleUndo}
          hasSnapshot={!!snapshot}
          onImport={() => setImportModalOpen(true)}
        />
        {isCanvasView && (
          <div className="pr-2">
            <NarrativeDropdown
              visibleLaneIds={visibleLaneIds}
              onToggleLane={handleToggleLane}
              onSelectAll={handleSelectAll}
              onClearAll={handleClearAll}
            />
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 relative overflow-hidden">
        {isCanvasView ? (
          <NarrativeCanvas visibleLaneIds={visibleLaneIds} />
        ) : (
          <NarrativeWeekView />
        )}
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
    </div>
  );
}
