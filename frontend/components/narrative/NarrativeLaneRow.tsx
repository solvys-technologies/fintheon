// [claude-code 2026-03-27] S4-T2: Single risk-category row in the NarrativeGridView
import { useState, useCallback, useMemo } from "react";
import type {
  CatalystCard as CatalystCardType,
  NarrativeAggregateCard,
  NarrativeCategory,
  ZoomLevel,
} from "../../lib/narrative-types";
import type { GridColumn } from "../../lib/narrative-grid-layout";
import {
  getColumnKeyForDate,
  LANE_ROW_HEIGHT,
} from "../../lib/narrative-grid-layout";
import NarrativeResearchCard from "./NarrativeResearchCard";
import NarrativeMiniCard from "./NarrativeMiniCard";

interface NarrativeLaneRowProps {
  category: NarrativeCategory;
  columns: GridColumn[];
  catalysts: CatalystCardType[];
  aggregates?: NarrativeAggregateCard[];
  zoomLevel: ZoomLevel;
  selectedCardId: string | null;
  onSelectCard: (id: string) => void;
  onDragCard?: (cardId: string, targetDate: string) => void;
  cardRefsMap: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  rowIndex: number;
  highlightMode?: boolean;
  onHighlightBranch?: (cardId: string, highlightedText: string) => void;
  onDrillDeeper?: (cardId: string, query: string) => void;
  showTitle?: boolean;
  showDescription?: boolean;
  scale?: number;
  onCardHover?: (id: string | null) => void;
}

const SEVERITY_BORDER: Record<string, string> = {
  high: "var(--fintheon-bearish)",
  medium: "var(--fintheon-accent)",
};

export default function NarrativeLaneRow({
  columns,
  catalysts,
  aggregates,
  zoomLevel,
  selectedCardId,
  onSelectCard,
  onDragCard,
  cardRefsMap,
  rowIndex,
  highlightMode = false,
  onHighlightBranch,
  onDrillDeeper,
  showTitle = true,
  showDescription = true,
  scale = 1,
  onCardHover,
}: NarrativeLaneRowProps) {
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const isReadOnly = zoomLevel === "quarter" || zoomLevel === "year";
  const useAggregates = zoomLevel !== "week";

  // Group catalysts by column key
  const cardsByColumn = useMemo(() => {
    const map = new Map<string, CatalystCardType[]>();
    for (const c of catalysts) {
      const key = getColumnKeyForDate(c.date, columns);
      if (!key) continue;
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return map;
  }, [catalysts, columns]);

  // Aggregate cards indexed by column key
  const aggByColumn = useMemo(() => {
    if (!aggregates) return new Map<string, NarrativeAggregateCard>();
    const map = new Map<string, NarrativeAggregateCard>();
    for (const a of aggregates) map.set(a.timeBucket, a);
    return map;
  }, [aggregates]);

  // Severity glow — left border based on highest severity in lane
  const severityBorder = useMemo(() => {
    const hasHigh = catalysts.some((c) => c.severity === "high");
    if (hasHigh) return SEVERITY_BORDER.high;
    const hasMed = catalysts.some((c) => c.severity === "medium");
    if (hasMed) return SEVERITY_BORDER.medium;
    return undefined;
  }, [catalysts]);

  const handleDragOver = useCallback(
    (e: React.DragEvent, colKey: string) => {
      if (isReadOnly) return;
      e.preventDefault();
      setDragOverCol(colKey);
    },
    [isReadOnly],
  );

  const handleDragLeave = useCallback(() => setDragOverCol(null), []);

  const handleDrop = useCallback(
    (e: React.DragEvent, col: GridColumn) => {
      if (isReadOnly) return;
      e.preventDefault();
      setDragOverCol(null);
      const cardId = e.dataTransfer.getData("text/plain");
      if (cardId && onDragCard) {
        onDragCard(cardId, col.startDate.toISOString().slice(0, 10));
      }
    },
    [isReadOnly, onDragCard],
  );

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const today = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  return (
    <div
      className="flex"
      style={{
        minHeight: `${LANE_ROW_HEIGHT}px`,
        borderLeft: severityBorder
          ? `3px solid ${severityBorder}`
          : "3px solid transparent",
        backgroundColor:
          rowIndex % 2 === 0
            ? "transparent"
            : "color-mix(in srgb, var(--fintheon-surface) 40%, transparent)",
      }}
    >
      {columns.map((col) => {
        const isToday = col.key === today;
        const isDragTarget = dragOverCol === col.key;

        return (
          <div
            key={col.key}
            className="flex flex-col gap-1 p-1 relative"
            style={{
              width: `${col.width}px`,
              minWidth: `${col.width}px`,
              borderRight:
                "1px solid color-mix(in srgb, var(--fintheon-border) 10%, transparent)",
              backgroundColor: isToday
                ? "color-mix(in srgb, var(--fintheon-accent) 5%, transparent)"
                : isDragTarget
                  ? "color-mix(in srgb, var(--fintheon-accent) 8%, transparent)"
                  : undefined,
              outline: isDragTarget
                ? "1px dashed var(--fintheon-accent)"
                : undefined,
              opacity: isReadOnly ? 0.7 : 1,
            }}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col)}
          >
            {useAggregates && aggregates
              ? // Aggregated card at month/quarter/year zoom
                (() => {
                  const agg = aggByColumn.get(col.key);
                  if (!agg) return null;
                  return (
                    <div
                      className="rounded-lg px-2 py-1.5 cursor-default"
                      style={{
                        backgroundColor:
                          "color-mix(in srgb, var(--fintheon-surface) 80%, transparent)",
                        border: `1px solid color-mix(in srgb, var(--fintheon-border) 30%, transparent)`,
                        backdropFilter: "blur(12px)",
                      }}
                    >
                      <p
                        className="text-[11px] font-semibold truncate"
                        style={{ color: "var(--fintheon-text)" }}
                      >
                        {agg.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className="text-[8px] rounded-full px-1.5 py-0.5 font-medium uppercase"
                          style={{
                            color:
                              agg.sentiment === "bullish"
                                ? "var(--fintheon-bullish)"
                                : "var(--fintheon-bearish)",
                            backgroundColor:
                              agg.sentiment === "bullish"
                                ? "color-mix(in srgb, var(--fintheon-bullish) 15%, transparent)"
                                : "color-mix(in srgb, var(--fintheon-bearish) 15%, transparent)",
                          }}
                        >
                          {agg.sentiment}
                        </span>
                        <span
                          className="text-[8px] font-mono"
                          style={{ color: "var(--fintheon-muted)" }}
                        >
                          {agg.cardCount} item{agg.cardCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  );
                })()
              : // Individual cards — render style based on zoom scale
                (cardsByColumn.get(col.key) ?? []).map((c, idx) => (
                  <div
                    key={c.id}
                    draggable={!isReadOnly && !highlightMode}
                    onDragStart={(e) => handleDragStart(e, c.id)}
                    ref={(el) => {
                      cardRefsMap.current[c.id] = el;
                    }}
                    onMouseEnter={() => onCardHover?.(c.id)}
                    onMouseLeave={() => onCardHover?.(null)}
                  >
                    {!showTitle ? (
                      // Dots-only view at very far zoom (< 0.4x)
                      <div
                        className="w-3 h-3 rounded-full cursor-pointer"
                        style={{
                          backgroundColor:
                            SEVERITY_BORDER[c.severity] ??
                            "var(--fintheon-muted)",
                          border:
                            selectedCardId === c.id
                              ? "2px solid var(--fintheon-accent)"
                              : undefined,
                        }}
                        onClick={() => onSelectCard(c.id)}
                        title={c.title}
                      />
                    ) : !showDescription ? (
                      // Mini card at medium zoom (0.4x - 0.7x)
                      <NarrativeMiniCard
                        card={c}
                        isSelected={selectedCardId === c.id}
                        isImported={c.source === "riskflow-import"}
                        onClick={() => onSelectCard(c.id)}
                        staggerIndex={idx}
                      />
                    ) : (
                      // Full card at close zoom (>= 0.7x)
                      <NarrativeResearchCard
                        catalyst={c}
                        compact
                        selected={selectedCardId === c.id}
                        highlightMode={highlightMode}
                        onSelect={onSelectCard}
                        onHighlightBranch={onHighlightBranch}
                        onDrillDeeper={onDrillDeeper}
                        cardRef={(el) => {
                          cardRefsMap.current[c.id] = el;
                        }}
                      />
                    )}
                  </div>
                ))}
          </div>
        );
      })}
    </div>
  );
}
