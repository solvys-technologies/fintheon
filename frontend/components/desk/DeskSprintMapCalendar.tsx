import { CalendarDays, FileText, Route, type LucideIcon } from "lucide-react";
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

type DeskMapView = "map" | "calendar" | "briefing";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const MULTI_REFETCH_EVENT = "fintheon:day-plan-multi-refetch";

export function DeskSprintMapCalendar({
  plans,
  isLoading,
}: {
  plans: DayPlan[];
  isLoading: boolean;
}) {
  const [view, setView] = useState<DeskMapView>("map");
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
            <Route className="h-3.5 w-3.5 text-[var(--fintheon-accent)]" />
            <h2 className="text-[11px] uppercase tracking-[0.24em] text-[var(--fintheon-accent)]">
              Desk Sprint Map
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
        <DeskSprintViewToggle view={view} onViewChange={setView} />
      </header>

      <div
        className={`mt-4 min-h-0 flex-1 ${
          view === "briefing" ? "overflow-hidden" : "overflow-y-auto pr-1"
        }`}
      >
        {isLoading ? (
          <p className="text-[11px] text-[var(--fintheon-muted)]/45">
            [LOADING...]
          </p>
        ) : view === "map" ? (
          <DeskPlanSprintTimeline
            plans={sortedPlans}
            segments={segments}
            segmentIndex={segmentIndex}
            deletingId={deletingId}
            onDelete={handleDelete}
          />
        ) : view === "briefing" ? (
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
      {view !== "briefing" ? (
        <DeskPlanRelativeScrubber
          segments={segments}
          segmentIndex={segmentIndex}
          onSegmentIndexChange={setSegmentIndex}
        />
      ) : null}
    </section>
  );
}

function DeskSprintViewToggle({
  view,
  onViewChange,
}: {
  view: DeskMapView;
  onViewChange: (view: DeskMapView) => void;
}) {
  return (
    <div className="inline-flex h-8 items-center gap-1 border-b border-[var(--fintheon-accent)]/10">
      <ToggleButton
        icon={Route}
        label="Map"
        isSelected={view === "map"}
        onClick={() => onViewChange("map")}
      />
      <ToggleButton
        icon={CalendarDays}
        label="Calendar"
        isSelected={view === "calendar"}
        onClick={() => onViewChange("calendar")}
      />
      <ToggleButton
        icon={FileText}
        label="Briefing"
        isSelected={view === "briefing"}
        onClick={() => onViewChange("briefing")}
      />
    </div>
  );
}

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
