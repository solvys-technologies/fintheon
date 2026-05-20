// [claude-code 2026-05-18] Dashboard desk-plan sprint map with timeline/calendar toggle.
import { CalendarDays, Route } from "lucide-react";
import { useMemo, useState } from "react";
import { useDayPlanMultiWeek } from "../../hooks/useDayPlanWeek";
import { formatEasternClockRange } from "../../lib/eastern-time-format";
import type { DayPlan } from "../../types/day-plan";

type MapView = "timeline" | "calendar";

export function DeskPlanSprintMap() {
  const { allPlans, isLoading } = useDayPlanMultiWeek();
  const [view, setView] = useState<MapView>("timeline");
  const week = useMemo(() => groupByDay(allPlans), [allPlans]);

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
          <p className="mt-1 text-[10px] text-[var(--fintheon-muted)]/55">
            Sprint timeline across published desk plans.
          </p>
        </div>
        <div className="inline-flex h-7 items-center rounded-md bg-[var(--fintheon-accent)]/[0.06] p-0.5">
          {(["timeline", "calendar"] as MapView[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`h-6 px-2 text-[9px] uppercase tracking-[0.14em] transition-colors rounded ${
                view === item
                  ? "bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]"
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
          <TimelinePlans plans={allPlans} />
        ) : (
          <CalendarPlans week={week} />
        )}
      </div>
    </section>
  );
}

function TimelinePlans({ plans }: { plans: DayPlan[] }) {
  if (plans.length === 0) return <EmptyMap />;
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
          <div className="min-w-0 border-l border-[var(--fintheon-accent)]/15 pl-4 pb-1">
            <h3 className="text-[12px] text-[var(--fintheon-text)]/90 line-clamp-1">
              {plan.eventName ?? "Desk session"}
            </h3>
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

function CalendarPlans({ week }: { week: Array<{ date: string; plans: DayPlan[] }> }) {
  if (week.length === 0) return <EmptyMap />;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
      {week.map((day) => (
        <section key={day.date} className="min-w-0 bg-[var(--fintheon-accent)]/[0.025] rounded-md p-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3 w-3 text-[var(--fintheon-accent)]/70" />
            <h3 className="font-mono text-[10px] text-[var(--fintheon-accent)]">
              {formatDate(day.date)}
            </h3>
          </div>
          <div className="mt-3 space-y-3">
            {day.plans.map((plan) => (
              <div key={plan.id} className="min-w-0">
                <p className="text-[11px] text-[var(--fintheon-text)]/80 line-clamp-2">
                  {plan.eventName ?? plan.deskTheme ?? "Desk session"}
                </p>
                <WindowList plan={plan} compact />
              </div>
            ))}
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

function EmptyMap() {
  return (
    <p className="text-[11px] text-[var(--fintheon-muted)]/45">
      No desk plans published for the current sprint map.
    </p>
  );
}

function groupByDay(plans: DayPlan[]) {
  const map = new Map<string, DayPlan[]>();
  for (const plan of plans) {
    const list = map.get(plan.date) ?? [];
    list.push(plan);
    map.set(plan.date, list);
  }
  return Array.from(map.entries()).map(([date, dayPlans]) => ({
    date,
    plans: dayPlans,
  }));
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
