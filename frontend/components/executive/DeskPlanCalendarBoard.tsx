import { CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { formatEasternClockRange } from "../../lib/eastern-time-format";
import { cn } from "../../lib/utils";
import type { DayPlan } from "../../types/day-plan";
import { EmptyCalendar } from "./DeskPlanMapEmptyStates";
import { formatDate } from "./DeskPlanMapUtils";
import { DeletePlanButton } from "./DeskPlanDeleteButton";

const POP_OUT_CARD =
  "rounded-md border border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-surface)]/75 transition-[transform,border-color,background-color,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform hover:-translate-y-1 hover:scale-[1.01] hover:border-[var(--fintheon-accent)]/25 hover:bg-[var(--fintheon-accent)]/[0.035] active:translate-y-0 active:scale-[0.995]";

export function DeskPlanCalendarBoard({
  days,
  hasPlans,
  focusedDate,
  deletingId,
  onDelete,
}: {
  days: Array<{ date: string; plans: DayPlan[] }>;
  hasPlans: boolean;
  focusedDate: string | null;
  deletingId: string | null;
  onDelete: (plan: DayPlan) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (!hasPlans) return <EmptyCalendar />;

  return (
    <div className="grid min-h-full grid-cols-1 gap-3 xl:grid-cols-5">
      {days.map((day) => (
        <section
          key={day.date}
          className={`min-h-[260px] rounded bg-[var(--fintheon-bg)]/[0.22] p-3 transition ${
            focusedDate === day.date ? "bg-[var(--fintheon-accent)]/[0.055]" : ""
          }`}
        >
          <div
            className="flex items-center gap-2 pb-2"
            style={{
              backgroundImage:
                "linear-gradient(to right, transparent, rgba(199,159,74,0.12), transparent)",
              backgroundPosition: "left bottom",
              backgroundRepeat: "no-repeat",
              backgroundSize: "100% 1px",
            }}
          >
            <CalendarDays className="h-3 w-3 text-[var(--fintheon-accent)]/65" />
            <h3 className="font-mono text-[10px] text-[var(--fintheon-accent)]">
              {formatDate(day.date)}
            </h3>
          </div>
          <div className="mt-3 space-y-2">
            {day.plans.length === 0 ? (
              <div className="px-3 py-4">
                <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]/35">
                  [OPEN]
                </p>
              </div>
            ) : (
              day.plans.map((plan) => (
                <CalendarPlanCard
                  key={plan.id}
                  plan={plan}
                  isExpanded={expandedId === plan.id}
                  deletingId={deletingId}
                  onDelete={onDelete}
                  onToggle={() =>
                    setExpandedId((current) => (current === plan.id ? null : plan.id))
                  }
                />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function CalendarPlanCard({
  plan,
  isExpanded,
  deletingId,
  onDelete,
  onToggle,
}: {
  plan: DayPlan;
  isExpanded: boolean;
  deletingId: string | null;
  onDelete: (plan: DayPlan) => void;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(POP_OUT_CARD, "w-full p-2 text-left")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 text-[11px] leading-snug text-[var(--fintheon-text)]/85">
            {plan.eventName ?? plan.deskTheme ?? "Desk session"}
          </p>
          <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)]/60">
            {plan.windows?.length ?? 0} windows
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <DeletePlanButton plan={plan} deletingId={deletingId} onDelete={onDelete} />
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </div>
      </div>
      {isExpanded ? <WindowList plan={plan} /> : null}
    </button>
  );
}

function WindowList({ plan }: { plan: DayPlan }) {
  const windows = plan.windows ?? [];
  if (windows.length === 0) {
    return (
      <p className="mt-3 font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)]/35">
        [NO WINDOWS]
      </p>
    );
  }
  return (
    <ul className="mt-3 space-y-2 border-t border-[var(--fintheon-accent)]/10 pt-2">
      {windows.map((window) => (
        <li key={window.id}>
          <p className="font-mono text-[9px] text-[var(--fintheon-accent)]/75">
            {formatEasternClockRange(window.startTime, window.endTime)}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-[var(--fintheon-text)]/60">
            {window.econForecast?.aiPrediction ?? window.eventName ?? "Forecast pending."}
          </p>
        </li>
      ))}
    </ul>
  );
}
