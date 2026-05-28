import {
  CalendarDays,
  FileText,
  Map as MapIcon,
  Route,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DAY_PLAN_REFETCH_EVENT } from "../../hooks/useDayPlan";
import type { DayPlan } from "../../types/day-plan";
import { DeskPlanCalendarBoard } from "../executive/DeskPlanCalendarBoard";
import { DeskPlanRelativeScrubber } from "../executive/DeskPlanRelativeScrubber";
import { DeskPlanSprintTimeline } from "../executive/DeskPlanSprintTimeline";
import { DeskBriefingPanel } from "./DeskBriefingPanel";
import {
  buildCalendarDays,
  buildSprintSegments,
  findNextDeskPlanSegmentIndex,
  formatDate,
  sortPlans,
} from "../executive/DeskPlanMapUtils";

type DeskMapView = "sprint" | "calendar" | "briefing";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const MULTI_REFETCH_EVENT = "fintheon:day-plan-multi-refetch";

export function DeskSprintMapCalendar({
  plans,
  isLoading,
  allowedViews,
}: {
  plans: DayPlan[];
  isLoading: boolean;
  allowedViews?: readonly DeskMapView[];
}) {
  const effectiveViews = allowedViews?.length ? allowedViews : ALL_VIEWS;
  const isFeedOnly =
    effectiveViews.length === 1 && effectiveViews[0] === "briefing";
  const initialView = effectiveViews.includes("sprint")
    ? "sprint"
    : effectiveViews[0];
  const [view, setView] = useState<DeskMapView>(initialView);
  const [renderedView, setRenderedView] = useState<DeskMapView>(initialView);
  const [viewPhase, setViewPhase] = useState<
    "entering" | "entered" | "exiting"
  >("entered");
  const [transitionDirection, setTransitionDirection] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const sortedPlans = useMemo(() => sortPlans(plans), [plans]);
  const calendarDays = useMemo(
    () => buildCalendarDays(sortedPlans),
    [sortedPlans],
  );
  const segments = useMemo(
    () => buildSprintSegments(sortedPlans),
    [sortedPlans],
  );
  const [segmentIndex, setSegmentIndex] = useState(0);
  const focusedDate = segments[segmentIndex]?.date ?? null;
  const windowCount = sortedPlans.reduce(
    (count, plan) => count + (plan.windows?.length ?? 0),
    0,
  );

  useEffect(() => {
    setSegmentIndex(findNextDeskPlanSegmentIndex(segments));
  }, [segments]);

  useEffect(() => {
    if (effectiveViews.includes(view)) return;
    const next = effectiveViews[0] ?? "briefing";
    setView(next);
    setRenderedView(next);
  }, [effectiveViews, renderedView, view]);

  useEffect(() => {
    if (view === renderedView) return;
    setViewPhase("exiting");
    const swapTimer = globalThis.setTimeout(() => {
      setRenderedView(view);
      setViewPhase("entering");
      globalThis.requestAnimationFrame(() => setViewPhase("entered"));
    }, 130);
    return () => globalThis.clearTimeout(swapTimer);
  }, [renderedView, view]);

  const handleSegmentIndexChange = (nextIndex: number) => {
    setTransitionDirection(nextIndex >= segmentIndex ? 1 : -1);
    setSegmentIndex(nextIndex);
  };

  const handleDelete = async (plan: DayPlan) => {
    if (plan.id.startsWith("plan-") || plan.id.startsWith("mem-")) return;
    setDeletingId(plan.id);
    setStatus(null);
    try {
      const response = await fetch(`${API_BASE}/api/day-plan/${plan.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setStatus(`[DELETED ${formatDate(plan.date).toUpperCase()}]`);
      window.dispatchEvent(new Event(DAY_PLAN_REFETCH_EVENT));
      window.dispatchEvent(new Event(MULTI_REFETCH_EVENT));
    } catch (error) {
      const message = error instanceof Error ? error.message : "delete failed";
      setStatus(`[ERROR: ${message.toUpperCase()}]`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden px-4 py-3">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {isFeedOnly ? (
              <FileText className="h-3.5 w-3.5 text-[var(--fintheon-accent)]" />
            ) : (
              <Route className="h-3.5 w-3.5 text-[var(--fintheon-accent)]" />
            )}
            <h2 className="text-[11px] uppercase tracking-[0.24em] text-[var(--fintheon-accent)]">
              {isFeedOnly ? "Desk Feed" : "Desk Sprint Map"}
            </h2>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-[10px] text-[var(--fintheon-muted)]/55">
              {sortedPlans.length} plans / {windowCount} windows scheduled.
            </p>
            {status ? (
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--fintheon-accent)]/65">
                {status}
              </p>
            ) : null}
          </div>
        </div>
        <DeskSprintViewToggle
          view={view}
          allowedViews={effectiveViews}
          onViewChange={setView}
        />
      </header>

      <div
        className={`mt-4 min-h-0 flex-1 ${
          renderedView === "briefing"
            ? "overflow-hidden"
            : "overflow-y-auto pr-1"
        }`}
      >
        <div
          className="desk-sprint-view-transition h-full min-h-0"
          data-phase={viewPhase}
        >
          {isLoading ? (
            <p className="text-[11px] text-[var(--fintheon-muted)]/45">
              [LOADING...]
            </p>
          ) : renderedView === "sprint" ? (
            <DeskPlanSprintTimeline
              plans={sortedPlans}
              segments={segments}
              segmentIndex={segmentIndex}
              transitionDirection={transitionDirection}
              deletingId={deletingId}
              onDelete={handleDelete}
            />
          ) : renderedView === "briefing" ? (
            <DeskBriefingPanel plans={sortedPlans} isLoading={isLoading} />
          ) : (
            <DeskPlanCalendarBoard
              days={calendarDays}
              hasPlans={sortedPlans.length > 0}
              focusedDate={focusedDate}
              deletingId={deletingId}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>
      {renderedView === "sprint" ? (
        <DeskPlanRelativeScrubber
          segments={segments}
          segmentIndex={segmentIndex}
          onSegmentIndexChange={handleSegmentIndexChange}
        />
      ) : null}
    </section>
  );
}

function DeskSprintViewToggle({
  view,
  allowedViews,
  onViewChange,
}: {
  view: DeskMapView;
  allowedViews: readonly DeskMapView[];
  onViewChange: (view: DeskMapView) => void;
}) {
  const options = VIEW_OPTIONS.filter((option) =>
    allowedViews.includes(option.view),
  );
  if (options.length <= 1) return null;

  return (
    <div className="inline-flex h-8 items-center justify-end gap-1">
      {options.map(({ view: optionView, icon, label }) => (
        <ToggleButton
          key={optionView}
          icon={icon}
          label={label}
          isSelected={view === optionView}
          onClick={() => onViewChange(optionView)}
        />
      ))}
    </div>
  );
}

const ALL_VIEWS: readonly DeskMapView[] = ["sprint", "calendar", "briefing"];
const VIEW_OPTIONS: ReadonlyArray<{
  view: DeskMapView;
  icon: LucideIcon;
  label: string;
}> = [
  { view: "briefing", icon: FileText, label: "Feed" },
  { view: "sprint", icon: MapIcon, label: "Sprint" },
  { view: "calendar", icon: CalendarDays, label: "Calendar" },
];

function ToggleButton({
  icon: Icon,
  label,
  isSelected,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={`inline-flex h-7 items-center gap-1.5 rounded-[4px] border px-2 text-[9px] uppercase tracking-[0.14em] transition-colors ${
        isSelected
          ? "border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)]"
          : "border-transparent text-[var(--fintheon-muted)]/60 hover:border-[var(--fintheon-accent)]/14 hover:text-[var(--fintheon-text)]"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}
