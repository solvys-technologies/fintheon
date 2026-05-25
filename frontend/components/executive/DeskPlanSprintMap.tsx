// [claude-code 2026-05-18] Dashboard desk-plan sprint map with timeline/calendar toggle.
// [codex 2026-05-22] Rebuilt as a scrub-able four-hour Sprint Map plus calendar board.
import { Route } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DAY_PLAN_REFETCH_EVENT } from "../../hooks/useDayPlan";
import { useDayPlanMultiWeek } from "../../hooks/useDayPlanWeek";
import type { DayPlan } from "../../types/day-plan";
import {
  buildCalendarDays,
  buildSprintSegments,
  findNextDeskPlanSegmentIndex,
  formatDate,
  sortPlans,
} from "./DeskPlanMapUtils";
import { DeskPlanCalendarBoard } from "./DeskPlanCalendarBoard";
import { DeskPlanRelativeScrubber } from "./DeskPlanRelativeScrubber";
import { DeskPlanSprintTimeline } from "./DeskPlanSprintTimeline";

type MapView = "map" | "calendar";
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const MULTI_REFETCH_EVENT = "fintheon:day-plan-multi-refetch";

export function DeskPlanSprintMap() {
  const { allPlans, isLoading } = useDayPlanMultiWeek();
  const [view, setView] = useState<MapView>("map");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const sortedPlans = useMemo(() => sortPlans(allPlans), [allPlans]);
  const calendarDays = useMemo(() => buildCalendarDays(sortedPlans), [sortedPlans]);
  const segments = useMemo(() => buildSprintSegments(sortedPlans), [sortedPlans]);
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
      const res = await fetch(`${API_BASE}/api/day-plan/${plan.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus(`[DELETED ${formatDate(plan.date).toUpperCase()}]`);
      window.dispatchEvent(new Event(DAY_PLAN_REFETCH_EVENT));
      window.dispatchEvent(new Event(MULTI_REFETCH_EVENT));
    } catch (err) {
      const message = err instanceof Error ? err.message : "delete failed";
      setStatus(`[ERROR: ${message.toUpperCase()}]`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="h-full min-h-0 px-4 py-3 flex flex-col overflow-hidden">
      <header className="shrink-0 flex items-center justify-between gap-3">
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
        <div className="inline-flex h-7 items-center rounded border border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-accent)]/[0.035] p-0.5">
          {(["map", "calendar"] as MapView[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              aria-pressed={view === item}
              className={`h-6 px-2 text-[9px] uppercase tracking-[0.14em] transition-colors rounded-[3px] ${
                view === item
                  ? "bg-[var(--fintheon-accent)]/12 text-[var(--fintheon-accent)]"
                  : "text-[var(--fintheon-muted)]/60 hover:text-[var(--fintheon-text)]"
              }`}
            >
              {item === "map" ? "sprint map" : "calendar"}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
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
      <DeskPlanRelativeScrubber
        segments={segments}
        segmentIndex={segmentIndex}
        onSegmentIndexChange={setSegmentIndex}
      />
    </section>
  );
}
