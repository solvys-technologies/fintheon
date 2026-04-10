// [claude-code 2026-03-16] Stone theme + narrative theme integration
import { useCallback, useState } from "react";
import type {
  CatalystCard as CatalystCardType,
  NarrativeLane as NarrativeLaneType,
} from "../../lib/narrative-types";
import { isSameDay } from "../../lib/narrative-time";
import NarrativeLaneHeader from "./NarrativeLaneHeader";
import CatalystCard from "./CatalystCard";
import GhostCard from "./GhostCard";

interface NarrativeLaneProps {
  lane: NarrativeLaneType;
  weekDates: Date[];
  catalysts: CatalystCardType[];
  selectedCatalystId: string | null;
  onSelectCatalyst: (id: string) => void;
  onMoveCatalyst: (id: string, newDate: string) => void;
  onSelectLane: (id: string) => void;
  onContextMenuLane?: (e: React.MouseEvent, id: string) => void;
  compact?: boolean;
  cardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  onDoubleClickDay?: (e: React.MouseEvent, date: Date) => void;
  isReplayMode?: boolean;
}

export default function NarrativeLane({
  lane,
  weekDates,
  catalysts,
  selectedCatalystId,
  onSelectCatalyst,
  onMoveCatalyst,
  onSelectLane,
  onContextMenuLane,
  compact = false,
  cardRefs,
  onDoubleClickDay,
  isReplayMode = false,
}: NarrativeLaneProps) {
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const isDecayed = lane.status === "decayed";
  const isForked = lane.parentId !== null;

  const handleDragOver = useCallback((e: React.DragEvent, date: Date) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(date.toISOString());
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, date: Date) => {
      e.preventDefault();
      setDragOverDate(null);
      const catalystId = e.dataTransfer.getData("text/plain");
      if (!catalystId) return;
      onMoveCatalyst(catalystId, date.toISOString().split("T")[0]);
    },
    [onMoveCatalyst],
  );

  const handleCardDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const catalystsForDate = (date: Date) =>
    catalysts.filter((c) => isSameDay(new Date(c.date), date));

  return (
    <div
      className="flex transition-opacity duration-1000"
      style={{
        opacity: isDecayed ? 0.35 : 1,
        paddingLeft: isForked ? "16px" : "0",
        borderBottom:
          "1px solid color-mix(in srgb, var(--fintheon-border) 15%, transparent)",
        position: "relative",
      }}
    >
      {/* Fork connector line */}
      {isForked && (
        <div
          className="absolute left-2 top-0 bottom-0"
          style={{
            width: "1px",
            backgroundColor:
              "color-mix(in srgb, var(--fintheon-accent) 30%, transparent)",
          }}
        />
      )}

      {/* Lane header */}
      <NarrativeLaneHeader
        lane={lane}
        selected={false}
        onSelect={onSelectLane}
        onContextMenu={onContextMenuLane}
      />

      {/* Day columns */}
      {weekDates.map((date) => {
        const dayCatalysts = catalystsForDate(date);
        const isDragOver = dragOverDate === date.toISOString();

        return (
          <div
            key={date.toISOString()}
            className="flex-1 flex flex-col gap-1.5 p-1.5 min-h-[90px] transition-colors duration-150"
            style={{
              borderLeft:
                "1px solid color-mix(in srgb, var(--fintheon-border) 10%, transparent)",
              backgroundColor: isDragOver
                ? "color-mix(in srgb, var(--fintheon-accent) 10%, transparent)"
                : "transparent",
            }}
            onDragOver={(e) => handleDragOver(e, date)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, date)}
            onDoubleClick={(e) => onDoubleClickDay?.(e, date)}
          >
            {dayCatalysts.map((catalyst) => {
              const CardComponent = catalyst.isGhost ? GhostCard : CatalystCard;
              return (
                <CardComponent
                  key={catalyst.id}
                  catalyst={catalyst}
                  compact={compact}
                  selected={catalyst.id === selectedCatalystId}
                  onSelect={onSelectCatalyst}
                  onDragStart={isReplayMode ? undefined : handleCardDragStart}
                  cardRef={(el) => {
                    cardRefs.current[catalyst.id] = el;
                  }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
