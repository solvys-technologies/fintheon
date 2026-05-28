import { useCallback, useEffect, useRef, useState } from "react";
import { useDayPlanMultiWeek } from "../../hooks/useDayPlanWeek";
import { DeskDailyBriefingPanel } from "./DeskDailyBriefingPanel";
import { DeskPlanWidget } from "./DeskPlanWidget";
import { DeskRiskSignalsPanel } from "./DeskRiskSignalsPanel";
import { DeskSprintMapCalendar } from "./DeskSprintMapCalendar";

const DESK_PAGES = ["Briefing", "Sprint Map"];

interface DeskDashboardPrototypeProps {
  onNavigateTab?: (tab: string) => void;
  deskSecondPageMode?: "all" | "feed-only";
}

export function DeskDashboardPrototype({
  onNavigateTab,
  deskSecondPageMode = "all",
}: DeskDashboardPrototypeProps) {
  const { allPlans, isLoading } = useDayPlanMultiWeek();
  const [activePage, setActivePage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToPage = useCallback((index: number) => {
    setActivePage(index);
    const container = containerRef.current;
    if (!container) return;
    const pages = container.querySelectorAll("[data-desk-page]");
    pages[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const pages = container.querySelectorAll("[data-desk-page]");
    let closestIndex = 0;
    let closestDistance = Infinity;
    pages.forEach((page, index) => {
      const pageTop =
        page.getBoundingClientRect().top -
        container.getBoundingClientRect().top;
      const distance = Math.abs(pageTop);
      if (distance >= closestDistance) return;
      closestIndex = index;
      closestDistance = distance;
    });
    setActivePage(closestIndex);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => scrollToPage(0), 50);
    return () => window.clearTimeout(timer);
  }, [scrollToPage]);

  return (
    <div className="relative flex h-full w-full bg-[var(--fintheon-bg)] text-[var(--fintheon-text)]">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 snap-y snap-mandatory overflow-hidden scroll-smooth"
      >
        <section
          data-desk-page="0"
          className="h-full min-h-0 snap-start overflow-hidden px-3 py-3"
        >
          <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
            <DeskDailyBriefingPanel />
            <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,0.92fr)] gap-4">
              <DeskPlanWidget />
              <DeskRiskSignalsPanel onNavigateTab={onNavigateTab} />
            </div>
          </div>
        </section>
        <section
          data-desk-page="1"
          className="h-full min-h-0 snap-start overflow-hidden px-2 py-2"
        >
          <DeskSprintMapCalendar
            plans={allPlans}
            isLoading={isLoading}
            allowedViews={
              deskSecondPageMode === "feed-only" ? ["briefing"] : undefined
            }
          />
        </section>
      </div>
      <DeskPrototypePager activePage={activePage} onSelect={scrollToPage} />
    </div>
  );
}

function DeskPrototypePager({
  activePage,
  onSelect,
}: {
  activePage: number;
  onSelect: (index: number) => void;
}) {
  return (
    <nav
      className="flex w-6 shrink-0 flex-col items-center justify-center gap-3 py-8"
      aria-label="Desk prototype pages"
    >
      {DESK_PAGES.map((label, index) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelect(index)}
          className="group relative flex items-center justify-center"
          title={label}
          aria-label={label}
          aria-current={activePage === index ? "page" : undefined}
        >
          <span
            className={`rounded-full transition-all duration-300 ${
              activePage === index
                ? "h-8 w-[3px] bg-[var(--fintheon-accent)]"
                : "h-5 w-[2px] bg-gray-700 group-hover:bg-gray-500"
            }`}
          />
        </button>
      ))}
    </nav>
  );
}
