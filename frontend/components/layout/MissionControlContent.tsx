// [claude-code 2026-04-03] Extracted from MainLayout.tsx — Strategium snap deck with widget pages
import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { KanbanTitle } from '../ui/KanbanTitle';
import { WidgetArrangeMenu } from '../mission-control/WidgetArrangeMenu';
import type { MissionWidgetId } from '../../lib/layoutOrderStorage';

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
}

export function MissionControlContent({
  orderedMissionWidgets,
  allMissionWidgets,
  missionWidgetVisibility,
  onReorder,
  onToggleVisibility,
  collapseFn,
}: MissionControlContentProps) {
  const missionDeckRef = useRef<HTMLDivElement>(null);
  const [missionDeckPage, setMissionDeckPage] = useState(0);

  const missionWidgetPages = useMemo(() => {
    const pages: Array<typeof orderedMissionWidgets> = [];
    for (let i = 0; i < orderedMissionWidgets.length; i += MISSION_WIDGETS_PER_PAGE) {
      pages.push(orderedMissionWidgets.slice(i, i + MISSION_WIDGETS_PER_PAGE));
    }
    return pages.length > 0 ? pages : [[]];
  }, [orderedMissionWidgets]);

  useEffect(() => {
    setMissionDeckPage((prev) => Math.min(prev, Math.max(0, missionWidgetPages.length - 1)));
  }, [missionWidgetPages.length]);

  const scrollMissionDeckToPage = useCallback((idx: number) => {
    setMissionDeckPage(idx);
    const el = missionDeckRef.current;
    if (!el) return;
    const pages = el.querySelectorAll('[data-mission-page]');
    if (pages[idx]) {
      pages[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleMissionDeckScroll = useCallback(() => {
    const el = missionDeckRef.current;
    if (!el) return;
    const pages = el.querySelectorAll('[data-mission-page]');
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

  return (
    <div className="h-full flex flex-col" data-tour-target="strategium">
      <KanbanTitle
        title="Strategium"
        tone="gold"
        headerRight={
          <div className="flex items-center gap-0.5">
            <WidgetArrangeMenu
              widgets={allMissionWidgets}
              visibility={missionWidgetVisibility}
              onReorder={onReorder}
              onToggleVisibility={onToggleVisibility}
            />
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
                return (
                  <div key={widget.id} className="p-3">
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
                      ? 'w-[3px] h-8 bg-[var(--fintheon-accent)]'
                      : 'w-[2px] h-5 bg-gray-700 hover:bg-gray-500'
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
