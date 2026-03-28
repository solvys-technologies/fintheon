// [claude-code 2026-03-27] S4-T2: 2D grid layout — time columns (X) x risk category rows (Y)
import { useRef, useMemo, useEffect, useCallback, useState } from 'react';
import { useNarrative } from '../../contexts/NarrativeContext';
import {
  RISK_LANES,
  RISK_LANE_LABELS,
  LANE_HEADER_WIDTH,
  LANE_ROW_HEIGHT,
  LANE_ROW_GAP,
  getGridColumns,
  getColumnKeyForDate,
} from '../../lib/narrative-grid-layout';
import { aggregateCards } from '../../lib/narrative-aggregator';
import { handleDrillDeeper, handleHighlightBranch } from '../../lib/narrative-ai-wiring';
import NarrativeLaneRow from './NarrativeLaneRow';
import NarrativeLaneHeader from './NarrativeLaneHeader';
import { NarrativeConnectionOverlay } from './NarrativeConnectionOverlay';
import { useHighlight } from './NarrativeHighlightProvider';
import type { NarrativeCategory } from '../../lib/narrative-types';

interface NarrativeGridViewProps {
  visibleLaneIds: Set<string>;
  activeTags: Set<string>;
}

export default function NarrativeGridView({ visibleLaneIds, activeTags }: NarrativeGridViewProps) {
  const { state, dispatch, catalystsForLane, activeLanes } = useNarrative();
  const { highlightMode } = useHighlight();

  // Card position refs — T4 needs these for drawing arrows
  const cardRefsMap = useRef<Record<string, HTMLDivElement | null>>({});
  // Grid container ref — T4 needs for SVG overlay positioning
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const anchorDate = useMemo(() => new Date(state.currentWeekStart), [state.currentWeekStart]);
  const columns = useMemo(() => getGridColumns(state.zoomLevel, anchorDate), [state.zoomLevel, anchorDate]);

  // Always show all risk category rows — filter by lane visibility if lanes exist
  const visibleLanes = useMemo(() => {
    return RISK_LANES.filter(cat => {
      const lane = activeLanes.find(l => l.category === cat);
      // Show the row if: no lanes exist at all, OR the matching lane is visible
      if (activeLanes.length === 0) return true;
      return !lane || visibleLaneIds.has(lane.id);
    });
  }, [activeLanes, visibleLaneIds]);

  // Map category -> lane for header rendering
  const laneByCategory = useMemo(() => {
    const map = new Map<NarrativeCategory, typeof activeLanes[number]>();
    for (const l of activeLanes) map.set(l.category, l);
    return map;
  }, [activeLanes]);

  // Filter catalysts by active tags (if any)
  const filterByTags = useCallback((catalysts: typeof state.catalysts) => {
    if (activeTags.size === 0) return catalysts;
    return catalysts.filter(c =>
      c.tags && c.tags.some(t => activeTags.has(t)),
    );
  }, [activeTags]);

  // Total grid width for the scrollable area
  const gridWidth = useMemo(() =>
    columns.reduce((sum, col) => sum + col.width, 0),
  [columns]);

  // Find column index for today to scroll to
  const todayColIdx = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const idx = columns.findIndex(col => {
      const d = new Date();
      return d >= col.startDate && d <= col.endDate;
    });
    return idx >= 0 ? idx : Math.floor(columns.length / 2);
  }, [columns]);

  // Center current day/week on mount
  useEffect(() => {
    if (!scrollRef.current || columns.length === 0) return;
    const scrollTarget = columns.slice(0, todayColIdx).reduce((sum, c) => sum + c.width, 0);
    const containerWidth = scrollRef.current.clientWidth;
    scrollRef.current.scrollLeft = Math.max(0, scrollTarget - containerWidth / 2 + columns[todayColIdx].width / 2);
  }, [columns, todayColIdx]);

  const handleSelectCard = useCallback((id: string) => {
    dispatch({ type: 'UPDATE_CATALYST', id, updates: {} }); // triggers selection in context
  }, [dispatch]);

  const handleDragCard = useCallback((cardId: string, targetDate: string) => {
    dispatch({ type: 'MOVE_CATALYST', id: cardId, date: targetDate, position: null });
  }, [dispatch]);

  const handleSelectLane = useCallback((id: string) => {
    // no-op for now, lane selection via context
  }, []);

  // ── Canvas-like zoom/pan interactions ──
  const ZOOM_LEVELS: typeof state.zoomLevel[] = ['week', 'month', 'quarter', 'year'];
  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

  // Spacebar hold = pan mode (grab cursor + drag). No zoom change.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceHeld(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Mouse wheel zoom (Ctrl/Cmd+wheel or pinch) + plain wheel = horizontal pan
  useEffect(() => {
    const container = gridContainerRef.current;
    const scroller = scrollRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Zoom: Ctrl+wheel or trackpad pinch
        e.preventDefault();
        if (zoomTimeoutRef.current) return;

        const currentIdx = ZOOM_LEVELS.indexOf(state.zoomLevel);
        const newIdx = e.deltaY > 0
          ? Math.min(currentIdx + 1, ZOOM_LEVELS.length - 1)
          : Math.max(currentIdx - 1, 0);

        if (newIdx !== currentIdx) {
          dispatch({ type: 'SET_ZOOM', level: ZOOM_LEVELS[newIdx] });
          zoomTimeoutRef.current = setTimeout(() => { zoomTimeoutRef.current = null; }, 250);
        }
      } else if (scroller && !e.shiftKey) {
        // Plain scroll wheel = horizontal pan (canvas behavior)
        e.preventDefault();
        scroller.scrollLeft += e.deltaY * 2;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [state.zoomLevel, dispatch]);

  // Click-drag pan (spacebar held or middle mouse)
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (spaceHeld || e.button === 1) { // spacebar + click or middle mouse
        e.preventDefault();
        setIsPanning(true);
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          scrollLeft: scroller.scrollLeft,
          scrollTop: scroller.scrollTop,
        };
        scroller.style.cursor = 'grabbing';
        scroller.setPointerCapture(e.pointerId);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      scroller.scrollLeft = panStartRef.current.scrollLeft - dx;
      scroller.scrollTop = panStartRef.current.scrollTop - dy;
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (panStartRef.current) {
        panStartRef.current = null;
        setIsPanning(false);
        scroller.style.cursor = '';
        scroller.releasePointerCapture(e.pointerId);
      }
    };

    scroller.addEventListener('pointerdown', handlePointerDown);
    scroller.addEventListener('pointermove', handlePointerMove);
    scroller.addEventListener('pointerup', handlePointerUp);
    return () => {
      scroller.removeEventListener('pointerdown', handlePointerDown);
      scroller.removeEventListener('pointermove', handlePointerMove);
      scroller.removeEventListener('pointerup', handlePointerUp);
    };
  }, [spaceHeld]);

  const onDrillDeeper = useCallback((cardId: string, query: string) => {
    const card = state.catalysts.find(c => c.id === cardId);
    if (card) handleDrillDeeper(cardId, query, card, dispatch);
  }, [state.catalysts, dispatch]);

  const onHighlightBranch = useCallback((cardId: string, highlightedText: string) => {
    const card = state.catalysts.find(c => c.id === cardId);
    if (card) handleHighlightBranch(card, highlightedText, dispatch);
  }, [state.catalysts, dispatch]);

  return (
    <div ref={gridContainerRef} className="h-full flex flex-col overflow-hidden" style={{ cursor: spaceHeld ? 'grab' : undefined }}>
      {/* Column headers */}
      <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid color-mix(in srgb, var(--fintheon-border) 20%, transparent)' }}>
        {/* Spacer for lane header column */}
        <div style={{ width: `${LANE_HEADER_WIDTH}px`, minWidth: `${LANE_HEADER_WIDTH}px` }} className="flex-shrink-0" />

        {/* Scrollable column headers */}
        <div className="flex-1 overflow-hidden">
          <div className="flex" style={{ width: `${gridWidth}px` }} ref={(el) => {
            // Sync header scroll with body scroll
            if (!el || !scrollRef.current) return;
            const body = scrollRef.current;
            const syncScroll = () => { el.scrollLeft = body.scrollLeft; };
            body.addEventListener('scroll', syncScroll);
            return () => body.removeEventListener('scroll', syncScroll);
          }}>
            {columns.map(col => {
              const isToday = (() => {
                const d = new Date();
                return d >= col.startDate && d <= col.endDate;
              })();
              return (
                <div
                  key={col.key}
                  className="flex items-center justify-center py-1.5 flex-shrink-0"
                  style={{
                    width: `${col.width}px`,
                    borderRight: '1px solid color-mix(in srgb, var(--fintheon-border) 10%, transparent)',
                    backgroundColor: isToday
                      ? 'color-mix(in srgb, var(--fintheon-accent) 5%, transparent)'
                      : undefined,
                  }}
                >
                  <span
                    className="text-[10px] font-mono"
                    style={{
                      color: isToday ? 'var(--fintheon-accent)' : 'var(--fintheon-muted)',
                      fontWeight: isToday ? 600 : 400,
                    }}
                  >
                    {col.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid body — lane headers (fixed) + scrollable cells */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Fixed lane headers */}
        <div
          className="flex-shrink-0 overflow-y-auto"
          style={{
            width: `${LANE_HEADER_WIDTH}px`,
            borderRight: '1px solid color-mix(in srgb, var(--fintheon-border) 20%, transparent)',
          }}
        >
          {visibleLanes.map((cat, idx) => {
            const lane = laneByCategory.get(cat);
            return (
              <div
                key={cat}
                className="flex items-center px-3"
                style={{
                  height: `${LANE_ROW_HEIGHT}px`,
                  marginBottom: `${LANE_ROW_GAP}px`,
                  backgroundColor: idx % 2 === 0
                    ? 'transparent'
                    : 'color-mix(in srgb, var(--fintheon-surface) 40%, transparent)',
                }}
              >
                {lane ? (
                  <NarrativeLaneHeader
                    lane={lane}
                    selected={state.selectedLaneId === lane.id}
                    onSelect={handleSelectLane}
                  />
                ) : (
                  <span className="text-[11px] font-medium" style={{ color: 'var(--fintheon-muted)' }}>
                    {RISK_LANE_LABELS[cat]}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Scrollable grid area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto"
        >
          <div style={{ width: `${gridWidth}px` }}>
            {visibleLanes.map((cat, idx) => {
              const lane = laneByCategory.get(cat);

              // Match catalysts by category field OR by lane membership
              const laneCatalysts = filterByTags(
                state.catalysts.filter(c => {
                  if (c.drillDepth !== 0) return false;
                  // Direct category match
                  if (c.category === cat) return true;
                  // Fallback: check if any of the card's lanes has this category
                  if (lane && c.narrativeIds.includes(lane.id)) return true;
                  return false;
                }),
              );

              const aggs = state.zoomLevel !== 'week'
                ? aggregateCards(laneCatalysts, columns, cat, state.zoomLevel)
                : undefined;

              return (
                <div key={cat} style={{ marginBottom: `${LANE_ROW_GAP}px` }}>
                  <NarrativeLaneRow
                    category={cat}
                    columns={columns}
                    catalysts={laneCatalysts}
                    aggregates={aggs}
                    zoomLevel={state.zoomLevel}
                    selectedCardId={state.selectedCatalystId}
                    onSelectCard={handleSelectCard}
                    onDragCard={handleDragCard}
                    cardRefsMap={cardRefsMap}
                    rowIndex={idx}
                    highlightMode={highlightMode}
                    onHighlightBranch={onHighlightBranch}
                    onDrillDeeper={onDrillDeeper}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* SVG connection overlay for branch arrows + cross-lane ropes */}
        <NarrativeConnectionOverlay
          catalysts={state.catalysts}
          ropes={state.ropes}
          cardRefsMap={cardRefsMap}
          containerRef={gridContainerRef}
          highlightMode={highlightMode}
        />
      </div>
    </div>
  );
}
