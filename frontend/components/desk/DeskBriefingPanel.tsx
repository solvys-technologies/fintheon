import { RefreshCw } from "lucide-react";
import type { DayPlan } from "../../types/day-plan";
import { DAY_PLAN_REFETCH_EVENT } from "../../hooks/useDayPlan";
import { KanbanTitle } from "../ui/KanbanTitle";
import {
  buildQueuedDeskEvents,
  countQueuedWindows,
  groupQueuedDeskEvents,
  type QueuedDeskEvent,
} from "./desk-queued-events";

const MULTI_REFETCH_EVENT = "fintheon:day-plan-multi-refetch";

export function DeskBriefingPanel({
  plans,
  isLoading,
  error,
}: {
  plans: DayPlan[];
  isLoading: boolean;
  error: string | null;
}) {
  const queuedEvents = buildQueuedDeskEvents(plans);
  const groups = groupQueuedDeskEvents(queuedEvents);
  const nextEvent = queuedEvents[0] ?? null;
  const planCount = plans.length;
  const windowCount = countQueuedWindows(plans);
  const refreshBrief = () => {
    window.dispatchEvent(new Event(DAY_PLAN_REFETCH_EVENT));
    window.dispatchEvent(new Event(MULTI_REFETCH_EVENT));
  };

  return (
    <section className="flex min-h-0 flex-col overflow-hidden px-2 py-1">
      <KanbanTitle
        title="Desk Briefing"
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
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <DeskBriefingLead
          isLoading={isLoading}
          error={error}
          nextEvent={nextEvent}
          planCount={planCount}
          windowCount={windowCount}
        />
        <div className="mt-4 space-y-4">
          {groups.map((group) => (
            <section key={group.date}>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]/72">
                {group.label}
              </h3>
              <div className="mt-2 space-y-2">
                {group.items.map((event) => (
                  <QueuedEventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

function DeskBriefingLead({
  isLoading,
  error,
  nextEvent,
  planCount,
  windowCount,
}: {
  isLoading: boolean;
  error: string | null;
  nextEvent: QueuedDeskEvent | null;
  planCount: number;
  windowCount: number;
}) {
  if (isLoading) {
    return (
      <p className="text-[13px] italic text-[var(--fintheon-text)]/35">
        Loading queued desk events...
      </p>
    );
  }
  if (error && !nextEvent) {
    return (
      <p className="text-[13px] text-[var(--fintheon-bearish)]/70">
        Queued desk plans unavailable.
      </p>
    );
  }
  if (!nextEvent) {
    return (
      <p className="text-[13px] text-[var(--fintheon-text)]/42">
        No queued desk events.
      </p>
    );
  }
  return (
    <div>
      <p className="text-[13px] leading-relaxed text-[var(--fintheon-text)]/82">
        {windowCount} queued windows across {planCount} desk plans. Next up:{" "}
        <span className="text-[var(--fintheon-accent)]">{nextEvent.title}</span>{" "}
        at {nextEvent.timeRange} ET.
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--fintheon-text)]/58">
        {nextEvent.prediction}
      </p>
    </div>
  );
}

function QueuedEventCard({ event }: { event: QueuedDeskEvent }) {
  return (
    <article className="rounded-md border border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-surface)]/44 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[9px] text-[var(--fintheon-accent)]/68">
            {event.timeRange} ET / {event.country}
          </p>
          <h4 className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--fintheon-text)]/90">
            {event.title}
          </h4>
        </div>
        <span className="shrink-0 rounded border border-[var(--fintheon-accent)]/14 px-2 py-1 font-mono text-[9px] text-[var(--fintheon-accent)]/74">
          {event.forecast}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-[10.5px] leading-relaxed text-[var(--fintheon-text)]/58">
        {event.prediction}
      </p>
      <div className="mt-2 flex items-center gap-2 font-mono text-[9px] text-[var(--fintheon-muted)]/48">
        <span>Miss {formatProbability(event.missProbability)}</span>
        <span className="h-1 w-1 rounded-full bg-[var(--fintheon-accent)]/28" />
        <span>Beat {formatProbability(event.beatProbability)}</span>
      </div>
    </article>
  );
}

function formatProbability(value: number | null) {
  return value == null ? "pending" : `${value}%`;
}
