// [claude-code 2026-03-06] NarrativeFlow NarrativeMonthView — condensed month view with week columns
import { useRef, useState, useCallback, useMemo } from 'react';
import { useNarrative } from '../../contexts/NarrativeContext';
import { getMonthWeeks, getWeekDates, formatWeekLabel, isSameDay } from '../../lib/narrative-time';
import type { CatalystCard as CatalystCardType } from '../../lib/narrative-types';
import NarrativeLaneHeader from './NarrativeLaneHeader';
import CatalystCard from './CatalystCard';
import GhostCard from './GhostCard';

const MONTHS_BEFORE = 2;
const MONTHS_AFTER = 2;
const TOTAL_MONTHS = MONTHS_BEFORE + 1 + MONTHS_AFTER;

function getMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getShortWeekLabel(monday: Date): string {
  const fri = new Date(monday);
  fri.setDate(monday.getDate() + 4);
  const mo = monday.toLocaleDateString('en-US', { month: 'short' });
  return `${mo} ${monday.getDate()}-${fri.getDate()}`;
}

export default function NarrativeMonthView() {
  const { state, dispatch, lanesFiltered } = useNarrative();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activePageIdx, setActivePageIdx] = useState(MONTHS_BEFORE);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const months = useMemo(() => {
    return Array.from({ length: TOTAL_MONTHS }, (_, i) => {
      const offset = i - MONTHS_BEFORE;
      let m = currentMonth + offset;
      let y = currentYear;
      while (m < 0) { m += 12; y--; }
      while (m > 11) { m -= 12; y++; }
      return { year: y, month: m };
    });
  }, [currentMonth, currentYear]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const pageH = el.clientHeight;
    const idx = Math.round(el.scrollTop / pageH);
    if (idx !== activePageIdx) setActivePageIdx(idx);
  }, [activePageIdx]);

  const handleSelectCatalyst = useCallback((id: string) => {
    dispatch({ type: 'UPDATE_CATALYST', id, updates: {} });
  }, [dispatch]);

  const handleSelectLane = useCallback((_id: string) => {
    // Lane selection
  }, []);

  const scrollToPage = useCallback((idx: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: idx * el.clientHeight, behavior: 'smooth' });
  }, []);

  const catalystsInWeek = (weekDates: Date[], laneId: string): CatalystCardType[] => {
    return state.catalysts.filter(c => {
      if (!c.narrativeIds.includes(laneId)) return false;
      const cDate = new Date(c.date);
      return weekDates.some(d => isSameDay(d, cDate));
    });
  };

  return (
    <div className="relative h-full flex">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scroll-smooth snap-y snap-mandatory"
      >
        {months.map(({ year, month }, idx) => {
          const weeks = getMonthWeeks(year, month);

          return (
            <div
              key={`${year}-${month}`}
              data-month-page={idx}
              className="min-h-full snap-start flex flex-col"
            >
              {/* Month header */}
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
                  {getMonthLabel(year, month)}
                </span>
                {weeks.map((monday) => (
                  <span
                    key={monday.toISOString()}
                    className="flex-1 text-center font-medium"
                    style={{ fontSize: '10px', color: 'var(--fintheon-muted)' }}
                  >
                    {getShortWeekLabel(monday)}
                  </span>
                ))}
              </div>

              {/* Lanes */}
              <div className="flex-1 flex flex-col">
                {lanesFiltered.map((lane) => {
                  const isDecayed = lane.status === 'decayed';
                  const isForked = lane.parentId !== null;

                  return (
                    <div
                      key={lane.id}
                      className="flex transition-opacity duration-1000"
                      style={{
                        opacity: isDecayed ? 0.35 : 1,
                        paddingLeft: isForked ? '16px' : '0',
                        borderBottom: '1px solid color-mix(in srgb, var(--fintheon-border) 15%, transparent)',
                        position: 'relative',
                      }}
                    >
                      {isForked && (
                        <div
                          className="absolute left-2 top-0 bottom-0"
                          style={{
                            width: '1px',
                            backgroundColor: 'color-mix(in srgb, var(--fintheon-accent) 30%, transparent)',
                          }}
                        />
                      )}

                      <NarrativeLaneHeader
                        lane={lane}
                        selected={false}
                        onSelect={handleSelectLane}
                      />

                      {/* Week columns */}
                      {weeks.map((monday) => {
                        const weekDates = getWeekDates(monday);
                        const weekCatalysts = catalystsInWeek(weekDates, lane.id);

                        return (
                          <div
                            key={monday.toISOString()}
                            className="flex-1 flex flex-col gap-1 p-1 min-h-[70px]"
                            style={{
                              borderLeft: '1px solid color-mix(in srgb, var(--fintheon-border) 10%, transparent)',
                            }}
                          >
                            {weekCatalysts.map((catalyst) => {
                              const CardComponent = catalyst.isGhost ? GhostCard : CatalystCard;
                              return (
                                <CardComponent
                                  key={catalyst.id}
                                  catalyst={catalyst}
                                  compact
                                  selected={catalyst.id === state.selectedCatalystId}
                                  onSelect={handleSelectCatalyst}
                                  cardRef={(el) => { cardRefs.current[catalyst.id] = el; }}
                                />
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Page indicator dots */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10">
        {months.map((_, idx) => (
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
    </div>
  );
}
