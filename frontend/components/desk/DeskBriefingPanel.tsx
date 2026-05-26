import { RefreshCw } from "lucide-react";
import type { DayPlan } from "../../types/day-plan";
import { DAY_PLAN_REFETCH_EVENT } from "../../hooks/useDayPlan";
import { KanbanTitle } from "../ui/KanbanTitle";
import { QueuedDeskEventFeed } from "./QueuedDeskEventFeed";

const MULTI_REFETCH_EVENT = "fintheon:day-plan-multi-refetch";

export function DeskBriefingPanel({
  plans,
  isLoading,
  error = null,
}: {
  plans: DayPlan[];
  isLoading: boolean;
  error?: string | null;
}) {
  const refreshBrief = () => {
    window.dispatchEvent(new Event(DAY_PLAN_REFETCH_EVENT));
    window.dispatchEvent(new Event(MULTI_REFETCH_EVENT));
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden px-2 py-1">
      <KanbanTitle
        title="Desk Feed"
        tone="gold"
        headerRight={
          <button
            type="button"
            onClick={refreshBrief}
            className="rounded p-1 text-zinc-500 transition-colors hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)] disabled:opacity-40"
            title="Refresh brief"
            aria-label="Refresh brief"
          >
            <RefreshCw
              className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
        }
      />
      <QueuedDeskEventFeed
        plans={plans}
        isLoading={isLoading}
        error={error}
        smooth
        className="mt-2 flex-1 px-4 py-3"
      />
    </section>
  );
}
