// [claude-code 2026-04-25] Reset-to-default button next to the Pencil — fades in/out via
//   t-dropdown (solvys-transitions) tied to editMode so it only appears in edit mode.
// [claude-code 2026-04-03] Extracted from MainLayout.tsx — Strategium snap deck with widget pages
// [claude-code 2026-04-17] Gear→Edit toggle; drag-reorder widget cards with microinteractions; unified edit mode
import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  ChevronRight,
  Pencil,
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { KanbanTitle } from "../ui/KanbanTitle";
import type { MissionWidgetId } from "../../lib/layoutOrderStorage";

const MISSION_WIDGETS_PER_PAGE = 2;

interface MissionWidget {
  id: MissionWidgetId;
  label: string;
  node: React.ReactNode;
}

interface MissionControlContentProps {
  orderedMissionWidgets: MissionWidget[];
  allMissionWidgets: { id: MissionWidgetId; label: string }[];
  missionWidgetVisibility: Record<MissionWidgetId, boolean>;
  onReorder: (order: MissionWidgetId[]) => void;
  onToggleVisibility: (id: MissionWidgetId) => void;
  collapseFn?: () => void;
  editMode?: boolean;
  onToggleEditMode?: () => void;
  /** Restore Strategium widget order + visibility to defaults. */
  onResetLayout?: () => void;
}

export function MissionControlContent({
  orderedMissionWidgets,
  allMissionWidgets,
  missionWidgetVisibility,
  onReorder,
  onToggleVisibility,
  collapseFn,
  editMode = false,
  onToggleEditMode,
  onResetLayout,
}: MissionControlContentProps) {
  const missionDeckRef = useRef<HTMLDivElement>(null);
  const [missionDeckPage, setMissionDeckPage] = useState(0);
  const [dragOverId, setDragOverId] = useState<MissionWidgetId | null>(null);

  const missionWidgetPages = useMemo(() => {
    const pages: Array<typeof orderedMissionWidgets> = [];
    for (
      let i = 0;
      i < orderedMissionWidgets.length;
      i += MISSION_WIDGETS_PER_PAGE
    ) {
      pages.push(orderedMissionWidgets.slice(i, i + MISSION_WIDGETS_PER_PAGE));
    }
    return pages.length > 0 ? pages : [[]];
  }, [orderedMissionWidgets]);

  useEffect(() => {
    setMissionDeckPage((prev) =>
      Math.min(prev, Math.max(0, missionWidgetPages.length - 1)),
    );
  }, [missionWidgetPages.length]);

  const scrollMissionDeckToPage = useCallback((idx: number) => {
    setMissionDeckPage(idx);
    const el = missionDeckRef.current;
    if (!el) return;
    const pages = el.querySelectorAll("[data-mission-page]");
    if (pages[idx]) {
      pages[idx].scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleMissionDeckScroll = useCallback(() => {
    const el = missionDeckRef.current;
    if (!el) return;
    const pages = el.querySelectorAll("[data-mission-page]");
    let closest = 0;
    let minDist = Infinity;
    pages.forEach((page, idx) => {
      const rect = page.getBoundingClientRect();
      const offset = Math.abs(rect.top - el.getBoundingClientRect().top);
      if (offset < minDist) {
        minDist = offset;
        closest = idx;
      }
    });
    setMissionDeckPage(closest);
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent, id: MissionWidgetId) => {
      e.dataTransfer.setData("text/plain", id);
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetId: MissionWidgetId) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverId(targetId);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: MissionWidgetId) => {
      e.preventDefault();
      setDragOverId(null);
      const sourceId = e.dataTransfer.getData("text/plain") as MissionWidgetId;
      if (!sourceId || sourceId === targetId) return;
      const currentOrder = allMissionWidgets.map((w) => w.id);
      const si = currentOrder.indexOf(sourceId);
      const ti = currentOrder.indexOf(targetId);
      if (si === -1 || ti === -1) return;
      const next = [...currentOrder];
      next.splice(si, 1);
      next.splice(ti, 0, sourceId);
      onReorder(next);
    },
    [allMissionWidgets, onReorder],
  );

  return (
    <div className="h-full flex flex-col" data-tour-target="strategium">
      <KanbanTitle
        title="Strategium"
        tone="gold"
        headerRight={
          <div className="flex items-center gap-0.5">
            {onToggleEditMode && (
              <button
                onClick={onToggleEditMode}
                className={`p-1 rounded transition-colors ${
                  editMode
                    ? "bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]"
                    : "hover:bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)]"
                }`}
                title={editMode ? "Finish editing layout" : "Edit layout"}
                aria-pressed={editMode}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {onResetLayout && (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "Reset Strategium widget order and visibility to defaults?",
                    )
                  ) {
                    onResetLayout();
                  }
                }}
                className={`t-dropdown p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] ${editMode ? "is-open" : ""}`}
                data-origin="top-right"
                title="Reset Strategium to defaults"
                aria-label="Reset Strategium to defaults"
                aria-hidden={!editMode}
                tabIndex={editMode ? 0 : -1}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            {collapseFn && (
              <button
                onClick={collapseFn}
                className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors"
                title="Collapse panel"
              >
                <ChevronRight className="w-3.5 h-3.5 text-[var(--fintheon-accent)]/60" />
              </button>
            )}
          </div>
        }
      />

      <div className="mt-2 flex-1 min-h-0 relative">
        <div
          ref={missionDeckRef}
          onScroll={handleMissionDeckScroll}
          className="h-full overflow-y-auto snap-y snap-mandatory"
        >
          {missionWidgetPages.map((page, pageIdx) => (
            <section
              key={`mission-page-${pageIdx}`}
              data-mission-page={pageIdx}
              className="min-h-full snap-start grid grid-rows-2 divide-y divide-[var(--fintheon-accent)]/15"
            >
              {[0, 1].map((slotIdx) => {
                const widget = page[slotIdx];
                if (!widget) {
                  return <div key={`slot-${slotIdx}`} className="p-3" />;
                }
                const isDragOver = dragOverId === widget.id;
                return (
                  <div
                    key={widget.id}
                    className={`mission-widget-slot p-3 relative ${
                      editMode ? "mission-widget-edit" : ""
                    } ${isDragOver ? "mission-widget-drop-target" : ""}`}
                    draggable={editMode}
                    onDragStart={
                      editMode
                        ? (e) => handleDragStart(e, widget.id)
                        : undefined
                    }
                    onDragOver={
                      editMode ? (e) => handleDragOver(e, widget.id) : undefined
                    }
                    onDragLeave={editMode ? handleDragLeave : undefined}
                    onDrop={
                      editMode ? (e) => handleDrop(e, widget.id) : undefined
                    }
                  >
                    {editMode && (
                      <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 pointer-events-none">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleVisibility(widget.id);
                          }}
                          className="pointer-events-auto p-1 rounded hover:bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] transition-colors"
                          title={
                            missionWidgetVisibility[widget.id] === false
                              ? "Show widget"
                              : "Hide widget"
                          }
                        >
                          {missionWidgetVisibility[widget.id] === false ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </button>
                        <div
                          className="pointer-events-auto p-1 rounded text-[var(--fintheon-accent)]/70 cursor-grab active:cursor-grabbing"
                          title="Drag to reorder"
                        >
                          <GripVertical className="w-3 h-3" />
                        </div>
                      </div>
                    )}
                    {widget.node}
                  </div>
                );
              })}
            </section>
          ))}
        </div>

        {missionWidgetPages.length > 1 && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-2">
            {missionWidgetPages.map((_, idx) => (
              <button
                key={`mission-dot-${idx}`}
                onClick={() => scrollMissionDeckToPage(idx)}
                title={`Mission page ${idx + 1}`}
                className="group relative flex items-center justify-center"
              >
                <div
                  className={`transition-all duration-300 rounded-full ${
                    missionDeckPage === idx
                      ? "w-[3px] h-8 bg-[var(--fintheon-accent)]"
                      : "w-[2px] h-5 bg-gray-700 hover:bg-gray-500"
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
