// [claude-code 2026-05-18] Dashboard desk-plan sprint map with timeline/calendar toggle.
import { CalendarDays, Route, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { DAY_PLAN_REFETCH_EVENT } from "../../hooks/useDayPlan";
import { useDayPlanMultiWeek } from "../../hooks/useDayPlanWeek";
import { formatEasternClockRange } from "../../lib/eastern-time-format";
import { cn } from "../../lib/utils";
import type { DayPlan } from "../../types/day-plan";
import { EmptyCalendar, EmptyTimeline } from "./DeskPlanMapEmptyStates";
import { buildCalendarDays, formatDate, sortPlans } from "./DeskPlanMapUtils";

type MapView = "timeline" | "calendar";
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const MULTI_REFETCH_EVENT = "fintheon:day-plan-multi-refetch";
const POP_OUT_CARD =
  "rounded border border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-surface)]/75 transition-[transform,border-color,background-color,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform hover:-translate-y-0.5 hover:border-[var(--fintheon-accent)]/25 hover:bg-[var(--fintheon-accent)]/[0.035] active:translate-y-0 active:scale-[0.995]";
const PLAN_ROW =
  "rounded-[4px] border border-[var(--fintheon-accent)]/[0.08] bg-[var(--fintheon-bg)]/[0.35] transition-[transform,border-color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:border-[var(--fintheon-accent)]/[0.18] hover:bg-[var(--fintheon-accent)]/[0.026] active:translate-y-0";

export function DeskPlanSprintMap() {
  const { allPlans, isLoading } = useDayPlanMultiWeek();
  const [view, setView] = useState<MapView>("timeline");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const sortedPlans = useMemo(() => sortPlans(allPlans), [allPlans]);
  const calendarDays = useMemo(() => buildCalendarDays(sortedPlans), [sortedPlans]);
  const windowCount = sortedPlans.reduce(
    (count, plan) => count + (plan.windows?.length ?? 0),
    0,
  );
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
              Desk Plan Map
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
          {(["timeline", "calendar"] as MapView[]).map((item) => (
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
              {item}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
        {isLoading ? (
          <p className="text-[11px] text-[var(--fintheon-muted)]/45">
            [LOADING...]
          </p>
        ) : view === "timeline" ? (
          <TimelinePlans
            plans={sortedPlans}
            deletingId={deletingId}
            onDelete={handleDelete}
          />
        ) : (
          <CalendarPlans
            days={calendarDays}
            hasPlans={sortedPlans.length > 0}
            deletingId={deletingId}
            onDelete={handleDelete}
          />
        )}
      </div>
    </section>
  );
}

function TimelinePlans({
  plans,
  deletingId,
  onDelete,
}: {
  plans: DayPlan[];
  deletingId: string | null;
  onDelete: (plan: DayPlan) => void;
}) {
  if (plans.length === 0) return <EmptyTimeline />;
  return (
    <div className="space-y-4">
      {plans.map((plan, index) => (
        <article key={plan.id} className="grid grid-cols-[92px_1fr] gap-4">
          <div className="text-right">
            <div className="font-mono text-[10px] text-[var(--fintheon-accent)]">
              {formatDate(plan.date)}
            </div>
            <div className="mt-0.5 text-[8px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]/40">
              Plan {index + 1}
            </div>
          </div>
          <div className={cn(POP_OUT_CARD, "min-w-0 p-3")}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[12px] text-[var(--fintheon-text)]/90 line-clamp-1">
                {plan.eventName ?? "Desk session"}
              </h3>
              <DeletePlanButton
                plan={plan}
                deletingId={deletingId}
                onDelete={onDelete}
              />
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--fintheon-text)]/65 line-clamp-2">
              {plan.deskTheme ?? "No desk theme published."}
            </p>
            <WindowList plan={plan} />
          </div>
        </article>
      ))}
    </div>
  );
}

function CalendarPlans({
  days,
  hasPlans,
  deletingId,
  onDelete,
}: {
  days: Array<{ date: string; plans: DayPlan[] }>;
  hasPlans: boolean;
  deletingId: string | null;
  onDelete: (plan: DayPlan) => void;
}) {
  if (!hasPlans) return <EmptyCalendar />;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
      {days.map((day) => (
        <section
          key={day.date}
          className={cn(POP_OUT_CARD, "min-w-0 p-3")}
        >
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3 w-3 text-[var(--fintheon-accent)]/70" />
            <h3 className="font-mono text-[10px] text-[var(--fintheon-accent)]">
              {formatDate(day.date)}
            </h3>
          </div>
          <div className="mt-3 space-y-3">
            {day.plans.length === 0 ? (
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]/35">
                [NO PLAN]
              </p>
            ) : (
              day.plans.map((plan) => (
                <div key={plan.id} className={cn(PLAN_ROW, "min-w-0 p-2")}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] text-[var(--fintheon-text)]/80 line-clamp-2">
                      {plan.eventName ?? plan.deskTheme ?? "Desk session"}
                    </p>
                    <DeletePlanButton
                      plan={plan}
                      deletingId={deletingId}
                      onDelete={onDelete}
                    />
                  </div>
                  <WindowList plan={plan} compact />
                </div>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function WindowList({ plan, compact = false }: { plan: DayPlan; compact?: boolean }) {
  const windows = plan.windows ?? [];
  if (windows.length === 0) return null;
  return (
    <ul className={`mt-2 space-y-1 ${compact ? "text-[9px]" : "text-[10px]"}`}>
      {windows.map((window) => (
        <li key={window.id} className="font-mono text-[var(--fintheon-muted)]/65">
          <span className="text-[var(--fintheon-accent)]/80">
            {formatEasternClockRange(window.startTime, window.endTime)}
          </span>
          <span className="mx-1">/</span>
          <span>
            {window.eventName ?? "Notable event"}
            {window.econForecast ? ` · Fcst ${window.econForecast.forecast}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DeletePlanButton({
  plan,
  deletingId,
  onDelete,
}: {
  plan: DayPlan;
  deletingId: string | null;
  onDelete: (plan: DayPlan) => void;
}) {
  const isSynthetic = plan.id.startsWith("plan-") || plan.id.startsWith("mem-");
  return (
    <button
      type="button"
      disabled={isSynthetic || deletingId === plan.id}
      onClick={() => onDelete(plan)}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border border-transparent text-[var(--fintheon-muted)]/45 transition-[transform,border-color,color,opacity] duration-200 hover:-translate-y-px hover:border-[var(--fintheon-bearish)]/20 hover:text-[var(--fintheon-bearish)] active:translate-y-0 disabled:cursor-default disabled:opacity-25"
      title={isSynthetic ? "Generated preview cannot be deleted" : "Delete desk plan"}
      aria-label="Delete desk plan"
    >
      <Trash2 className="h-3 w-3" />
    </button>
  );
}
