// [claude-code 2026-03-16] Stone theme + narrative theme integration
import { useRef, useState, useCallback, useMemo } from 'react';
import { useNarrative } from '../../contexts/NarrativeContext';
import { getMonday, getWeekDates, shiftWeek, formatWeekLabel, formatDayLabel } from '../../lib/narrative-time';
import NarrativeLane from './NarrativeLane';
import CatalystPillInput from './CatalystPillInput';

const WEEKS_BEFORE = 4;
const WEEKS_AFTER = 4;
const TOTAL_WEEKS = WEEKS_BEFORE + 1 + WEEKS_AFTER;

export default function NarrativeWeekView() {
  const { state, dispatch, lanesFiltered } = useNarrative();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activePageIdx, setActivePageIdx] = useState(WEEKS_BEFORE);

  // Pill input state
  const [pillInput, setPillInput] = useState<{
    position: { x: number; y: number };
    date: string;
    narrativeId: string;
  } | null>(null);

  // Add lane form
  const [showAddLane, setShowAddLane] = useState(false);
  const [newLaneTitle, setNewLaneTitle] = useState('');
  const [newLaneInstruments, setNewLaneInstruments] = useState('');
  const [newLaneDirection, setNewLaneDirection] = useState<'long' | 'short' | 'neutral'>('neutral');

  const currentMonday = useMemo(() => getMonday(new Date(state.currentWeekStart)), [state.currentWeekStart]);

  const weeks = useMemo(() => {
    return Array.from({ length: TOTAL_WEEKS }, (_, i) =>
      shiftWeek(currentMonday, i - WEEKS_BEFORE)
    );
  }, [currentMonday]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const pageH = el.clientHeight;
    const idx = Math.round(el.scrollTop / pageH);
    if (idx !== activePageIdx) setActivePageIdx(idx);
  }, [activePageIdx]);

  const handleSelectCatalyst = useCallback((id: string) => {
    dispatch({ type: 'UPDATE_CATALYST', id, updates: {} });
    // Use a separate state selection mechanism
    // The state.selectedCatalystId is managed via context in a full implementation
  }, [dispatch]);

  const handleMoveCatalyst = useCallback((id: string, newDate: string) => {
    dispatch({ type: 'MOVE_CATALYST', id, date: newDate, position: null });
  }, [dispatch]);

  const handleSelectLane = useCallback((id: string) => {
    // Lane selection handled via context
  }, []);

  const handleDoubleClickDay = useCallback((e: React.MouseEvent, date: Date) => {
    if (state.replayMode) return;
    // Find which lane was clicked by checking the target
    const laneEl = (e.target as HTMLElement).closest('[data-lane-id]');
    const narrativeId = laneEl?.getAttribute('data-lane-id') || lanesFiltered[0]?.id;
    if (!narrativeId) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPillInput({
      position: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      date: date.toISOString().split('T')[0],
      narrativeId,
    });
  }, [state.replayMode, lanesFiltered]);

  const handlePillSubmit = useCallback((title: string) => {
    if (!pillInput) return;
    dispatch({
      type: 'ADD_CATALYST',
      catalyst: {
        title,
        description: '',
        date: pillInput.date,
        sentiment: 'bullish',
        severity: 'medium',
        source: 'user',
        narrativeIds: [pillInput.narrativeId],
        isGhost: false,
        templateType: null,
        position: null,
        drillDepth: 0,
      },
    });
    setPillInput(null);
  }, [pillInput, dispatch]);

  const handleAddLane = useCallback(() => {
    if (!newLaneTitle.trim()) return;
    dispatch({
      type: 'ADD_LANE',
      lane: {
        title: newLaneTitle.trim(),
        instruments: newLaneInstruments.split(',').map(s => s.trim()).filter(Boolean),
        directionBias: newLaneDirection,
        category: 'macroeconomic',
        status: 'active',
        dateRange: { start: new Date().toISOString(), end: null },
        healthScore: 100,
        color: 'var(--fintheon-accent)',
        order: lanesFiltered.length,
        parentId: null,
        forkDate: null,
        decayWeeks: 0,
      },
    });
    setNewLaneTitle('');
    setNewLaneInstruments('');
    setNewLaneDirection('neutral');
    setShowAddLane(false);
  }, [newLaneTitle, newLaneInstruments, newLaneDirection, lanesFiltered.length, dispatch]);

  const scrollToPage = useCallback((idx: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: idx * el.clientHeight, behavior: 'smooth' });
  }, []);

  return (
    <div className="relative h-full flex">
      {/* Main content area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scroll-smooth snap-y snap-mandatory"
      >
        {weeks.map((monday, idx) => {
          const weekDates = getWeekDates(monday);
          const weekCatalysts = state.catalysts.filter(c => {
            const cDate = new Date(c.date);
            return cDate >= weekDates[0] && cDate <= weekDates[weekDates.length - 1];
          });

          return (
            <div
              key={monday.toISOString()}
              data-week-page={idx}
              className="min-h-full snap-start flex flex-col"
            >
              {/* Week header */}
              <div
                className="flex-shrink-0 flex items-center px-4 py-2"
                style={{
                  borderBottom: '1px solid color-mix(in srgb, var(--fintheon-border) 20%, transparent)',
                }}
              >
                <span
                  className="font-semibold"
                  style={{ fontSize: '13px', color: 'var(--fintheon-text)', width: '180px' }}
                >
                  {formatWeekLabel(monday)}
                </span>
                {weekDates.map((date) => (
                  <span
                    key={date.toISOString()}
                    className="flex-1 text-center font-medium"
                    style={{ fontSize: '11px', color: 'var(--fintheon-muted)' }}
                  >
                    {formatDayLabel(date)}
                  </span>
                ))}
              </div>

              {/* Lanes */}
              <div className="flex-1 flex flex-col">
                {lanesFiltered.map((lane) => {
                  const laneCatalysts = weekCatalysts.filter(c =>
                    c.narrativeIds.includes(lane.id)
                  );
                  return (
                    <div key={lane.id} data-lane-id={lane.id}>
                      <NarrativeLane
                        lane={lane}
                        weekDates={weekDates}
                        catalysts={laneCatalysts}
                        selectedCatalystId={state.selectedCatalystId}
                        onSelectCatalyst={handleSelectCatalyst}
                        onMoveCatalyst={handleMoveCatalyst}
                        onSelectLane={handleSelectLane}
                        compact={false}
                        cardRefs={cardRefs}
                        onDoubleClickDay={handleDoubleClickDay}
                        isReplayMode={state.replayMode}
                      />
                    </div>
                  );
                })}

                {/* Add lane button / form */}
                <div className="flex-shrink-0 px-4 py-3">
                  {showAddLane ? (
                    <div
                      className="flex items-center gap-2 rounded-lg px-3 py-2"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 80%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--fintheon-border) 30%, transparent)',
                      }}
                    >
                      <input
                        type="text"
                        value={newLaneTitle}
                        onChange={(e) => setNewLaneTitle(e.target.value)}
                        placeholder="Narrative title..."
                        className="bg-transparent border-none outline-none flex-1"
                        style={{ fontSize: '11px', color: 'var(--fintheon-text)' }}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddLane();
                          if (e.key === 'Escape') setShowAddLane(false);
                        }}
                      />
                      <input
                        type="text"
                        value={newLaneInstruments}
                        onChange={(e) => setNewLaneInstruments(e.target.value)}
                        placeholder="ES, NQ..."
                        className="bg-transparent border-none outline-none"
                        style={{ fontSize: '11px', color: 'var(--fintheon-text)', width: '80px' }}
                      />
                      <select
                        value={newLaneDirection}
                        onChange={(e) => setNewLaneDirection(e.target.value as 'long' | 'short' | 'neutral')}
                        className="bg-transparent border-none outline-none cursor-pointer"
                        style={{ fontSize: '11px', color: 'var(--fintheon-text)' }}
                      >
                        <option value="neutral">Neutral</option>
                        <option value="long">Long</option>
                        <option value="short">Short</option>
                      </select>
                      <button
                        onClick={handleAddLane}
                        className="rounded px-2 py-0.5 font-medium transition-colors"
                        style={{
                          fontSize: '10px',
                          color: 'var(--fintheon-accent)',
                          backgroundColor: 'color-mix(in srgb, var(--fintheon-accent) 15%, transparent)',
                        }}
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setShowAddLane(false)}
                        className="rounded px-2 py-0.5 transition-colors"
                        style={{ fontSize: '10px', color: 'var(--fintheon-muted)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddLane(true)}
                      className="rounded-lg px-3 py-1.5 font-medium transition-colors hover:opacity-80"
                      style={{
                        fontSize: '11px',
                        color: 'var(--fintheon-accent)',
                        backgroundColor: 'color-mix(in srgb, var(--fintheon-accent) 8%, transparent)',
                        border: '1px dashed color-mix(in srgb, var(--fintheon-accent) 30%, transparent)',
                      }}
                    >
                      + Add Narrative
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Page indicator dots */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10">
        {weeks.map((_, idx) => (
          <button
            key={idx}
            onClick={() => scrollToPage(idx)}
            className="rounded-full transition-all duration-200"
            style={{
              width: idx === activePageIdx ? '8px' : '6px',
              height: idx === activePageIdx ? '8px' : '6px',
              backgroundColor: idx === activePageIdx
                ? 'var(--fintheon-accent)'
                : 'color-mix(in srgb, var(--fintheon-muted) 40%, transparent)',
            }}
          />
        ))}
      </div>

      {/* Floating pill input */}
      {pillInput && (
        <CatalystPillInput
          position={pillInput.position}
          date={pillInput.date}
          narrativeId={pillInput.narrativeId}
          onSubmit={handlePillSubmit}
          onClose={() => setPillInput(null)}
        />
      )}
    </div>
  );
}
