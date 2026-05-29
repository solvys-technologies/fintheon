import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from "react";
import { useDayPlanMultiWeek } from "../../hooks/useDayPlanWeek";
import { DeskDailyBriefingPanel } from "./DeskDailyBriefingPanel";
import { DeskPlanWidget } from "./DeskPlanWidget";
import { DeskRiskSignalsPanel } from "./DeskRiskSignalsPanel";
import { DeskSprintMapCalendar } from "./DeskSprintMapCalendar";

const DESK_PAGES = ["Briefing", "Sprint Map"];
const MOBILE_DESK_PAGES = [
  "Briefing",
  "Desk Plan",
  "Risk Signals",
  "Desk Feed",
];

interface DeskDashboardPrototypeProps {
  onNavigateTab?: (tab: string) => void;
  deskSecondPageMode?: "all" | "feed-only";
}

export function DeskDashboardPrototype({
  onNavigateTab,
  deskSecondPageMode = "all",
}: DeskDashboardPrototypeProps) {
  const { allPlans, isLoading } = useDayPlanMultiWeek();
  const pageLabels =
    deskSecondPageMode === "feed-only" ? MOBILE_DESK_PAGES : DESK_PAGES;
  const [activePage, setActivePage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{
    x: number;
    y: number;
    target: EventTarget | null;
    zone: "top" | "bottom";
  } | null>(null);

  const scrollToPage = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(index, pageLabels.length - 1));
      setActivePage(next);
      if (deskSecondPageMode === "feed-only") return;
      const container = containerRef.current;
      if (!container) return;
      const pages = container.querySelectorAll("[data-desk-page]");
      pages[next]?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [deskSecondPageMode, pageLabels.length],
  );

  const handleScroll = useCallback(() => {
    if (deskSecondPageMode === "feed-only") return;
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
  }, [deskSecondPageMode]);

  const handleMobileTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (deskSecondPageMode !== "feed-only") return;
      const touch = event.touches[0];
      if (!touch) {
        touchStartRef.current = null;
        return;
      }
      const activeSection = containerRef.current?.querySelector(
        `[data-desk-page="${activePage}"]`,
      );
      const rect = activeSection?.getBoundingClientRect();
      if (!rect) {
        touchStartRef.current = null;
        return;
      }
      const edgeZone = 112;
      const zone =
        touch.clientY >= rect.bottom - edgeZone
          ? "bottom"
          : touch.clientY <= rect.top + edgeZone
            ? "top"
            : null;
      touchStartRef.current = zone
        ? { x: touch.clientX, y: touch.clientY, target: event.target, zone }
        : null;
    },
    [activePage, deskSecondPageMode],
  );

  const handleMobileTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (deskSecondPageMode !== "feed-only") return;
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const deltaY = touch.clientY - start.y;
      const deltaX = Math.abs(touch.clientX - start.x);
      if (Math.abs(deltaY) < 112 || deltaX > 54) return;
      const direction = deltaY < 0 ? 1 : -1;
      if (direction > 0 && start.zone !== "bottom") return;
      if (direction < 0 && start.zone !== "top") return;
      if (hasScrollableRoom(start.target, direction)) return;
      scrollToPage(activePage + direction);
    },
    [activePage, deskSecondPageMode, scrollToPage],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => scrollToPage(0), 50);
    return () => window.clearTimeout(timer);
  }, [scrollToPage]);

  if (deskSecondPageMode === "feed-only") {
    return (
      <div
        ref={containerRef}
        className="relative flex h-full w-full touch-pan-y overflow-hidden bg-[var(--fintheon-bg)] text-[var(--fintheon-text)]"
        onTouchStart={handleMobileTouchStart}
        onTouchEnd={handleMobileTouchEnd}
      >
        <div className="min-h-0 flex-1 overflow-hidden">
          <div
            className="h-full transition-[transform] duration-[360ms] ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform"
            style={{
              transform: `translate3d(0, -${activePage * 100}%, 0)`,
            }}
          >
            <MobileDeskPage index={0} activePage={activePage}>
              <DeskDailyBriefingPanel />
            </MobileDeskPage>
            <MobileDeskPage index={1} activePage={activePage}>
              <DeskPlanWidget />
            </MobileDeskPage>
            <MobileDeskPage index={2} activePage={activePage}>
              <DeskRiskSignalsPanel onNavigateTab={onNavigateTab} />
            </MobileDeskPage>
            <MobileDeskPage index={3} activePage={activePage}>
              <DeskSprintMapCalendar
                plans={allPlans}
                isLoading={isLoading}
                allowedViews={["briefing"]}
              />
            </MobileDeskPage>
          </div>
        </div>
        <DeskPrototypePager
          activePage={activePage}
          labels={pageLabels}
          onSelect={scrollToPage}
        />
      </div>
    );
  }

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
          <DeskSprintMapCalendar plans={allPlans} isLoading={isLoading} />
        </section>
      </div>
      <DeskPrototypePager
        activePage={activePage}
        labels={pageLabels}
        onSelect={scrollToPage}
      />
    </div>
  );
}

function MobileDeskPage({
  index,
  activePage,
  children,
}: {
  index: number;
  activePage: number;
  children: ReactNode;
}) {
  const offset = index - activePage;
  return (
    <section
      data-desk-page={index}
      data-active={index === activePage ? "true" : "false"}
      className="h-full min-h-0 overflow-hidden px-3 py-3 transition-[opacity,transform,filter] duration-[360ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
      style={{
        opacity: Math.abs(offset) > 1 ? 0.24 : 1,
        filter: offset === 0 ? "blur(0)" : "blur(1px)",
        transform:
          offset === 0
            ? "scale(1)"
            : `translateY(${offset > 0 ? 8 : -8}px) scale(0.986)`,
      }}
    >
      {children}
    </section>
  );
}

function hasScrollableRoom(target: EventTarget | null, direction: number) {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node.dataset.deskPage == null) {
    const style = window.getComputedStyle(node);
    const canScroll =
      /(auto|scroll)/.test(style.overflowY) &&
      node.scrollHeight > node.clientHeight + 2;
    if (canScroll) {
      if (direction > 0) {
        return node.scrollTop + node.clientHeight < node.scrollHeight - 4;
      }
      return node.scrollTop > 4;
    }
    node = node.parentElement;
  }
  return false;
}

function DeskPrototypePager({
  activePage,
  labels,
  onSelect,
}: {
  activePage: number;
  labels: string[];
  onSelect: (index: number) => void;
}) {
  return (
    <nav
      className="flex w-6 shrink-0 flex-col items-center justify-center gap-3 py-8"
      aria-label="Desk prototype pages"
    >
      {labels.map((label, index) => (
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
