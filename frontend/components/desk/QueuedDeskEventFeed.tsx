import { useEffect, useMemo, useRef, useState } from "react";
import Lenis from "lenis";
import { ChevronDown } from "lucide-react";
import type { DayPlan } from "../../types/day-plan";
import { FadingRuler } from "../shared/FadingRuler";
import { DeskPlanInlineWidget } from "./DeskPlanInlineWidget";
import {
  buildQueuedDeskEvents,
  groupQueuedDeskEvents,
  type QueuedDeskEvent,
} from "./desk-queued-events";

export function QueuedDeskEventFeed({
  plans,
  isLoading,
  error = null,
  compact = false,
  maxItems,
  smooth = false,
  className = "",
}: {
  plans: DayPlan[];
  isLoading: boolean;
  error?: string | null;
  compact?: boolean;
  maxItems?: number;
  smooth?: boolean;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const events = useMemo(() => buildQueuedDeskEvents(plans), [plans]);
  const visibleEvents = maxItems ? events.slice(0, maxItems) : events;
  const groups = useMemo(
    () => groupQueuedDeskEvents(visibleEvents),
    [visibleEvents],
  );

  useEffect(() => {
    if (!smooth || !scrollRef.current || !contentRef.current) return;
    const lenis = new Lenis({
      wrapper: scrollRef.current,
      content: contentRef.current,
      duration: 0.85,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
    } as ConstructorParameters<typeof Lenis>[0]);
    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [smooth]);

  if (isLoading) {
    return (
      <div className={className}>
        <p className="text-[12px] italic text-[var(--fintheon-text)]/35">
          Loading queued desk events...
        </p>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className={className}>
        <p className="text-[12px] text-[var(--fintheon-bearish)]/70">
          Queued desk plans unavailable.
        </p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={className}>
        <p className="text-[12px] text-[var(--fintheon-text)]/42">
          No queued desk events.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={`min-h-0 overflow-y-auto pr-1 ${className}`}
      data-desk-queued-feed
    >
      <div ref={contentRef} className={compact ? "space-y-3" : "space-y-5"}>
        {groups.map((group, groupIndex) => (
          <section key={group.date}>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]/72">
              {group.label}
            </h3>
            <div className={compact ? "mt-1.5" : "mt-2"}>
              {group.items.map((event, index) => {
                const absoluteIndex =
                  groups
                    .slice(0, groupIndex)
                    .reduce((count, prior) => count + prior.items.length, 0) +
                  index;
                return (
                  <QueuedDeskEventRow
                    key={event.id}
                    event={event}
                    index={absoluteIndex}
                    compact={compact}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function QueuedDeskEventRow({
  event,
  index,
  compact,
}: {
  event: QueuedDeskEvent;
  index: number;
  compact: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const afterThirdOpacity = index <= 2 ? 1 : Math.max(0.28, 0.86 - index * 0.1);
  const toggleExpanded = () => setIsExpanded((value) => !value);
  return (
    <article
      className={`group ${index > 0 ? "pt-2" : ""}`}
      style={{ opacity: afterThirdOpacity }}
    >
      {index > 0 ? <FadingRuler className="mb-2 opacity-50" /> : null}
      <div
        role="button"
        tabIndex={0}
        onClick={toggleExpanded}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleExpanded();
          }
        }}
        className={`grid gap-3 ${
          compact ? "grid-cols-[1fr_auto]" : "grid-cols-[minmax(0,1fr)_auto]"
        } cursor-pointer rounded-sm py-1 transition-[transform,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:translate-x-0.5`}
        aria-expanded={isExpanded}
      >
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--fintheon-accent)]/60">
            {event.timeRange} ET / {event.country}
          </p>
          <h4
            className={`mt-1 line-clamp-2 font-semibold leading-snug text-[var(--fintheon-text)]/90 ${
              compact ? "text-[11.5px]" : "text-[13px]"
            }`}
          >
            {event.title}
          </h4>
          <p
            className={`mt-1.5 leading-relaxed text-[var(--fintheon-text)]/58 ${
              compact ? "line-clamp-2 text-[10px]" : "line-clamp-3 text-[11px]"
            }`}
          >
            {event.prediction}
          </p>
          <div className="mt-2 flex items-center gap-2 font-mono text-[8.5px] text-[var(--fintheon-muted)]/48">
            <span>Miss {event.missPrint ?? "\u2014"}</span>
            <span className="h-1 w-px bg-[var(--fintheon-accent)]/18" />
            <span>Beat {event.beatPrint ?? "\u2014"}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <span className="rounded-sm border border-[var(--fintheon-accent)]/14 px-1.5 py-0.5 font-mono text-[8.5px] text-[var(--fintheon-accent)]/74">
            {event.forecast}
          </span>
          <ChevronDown
            className={`mt-0.5 h-3 w-3 text-[var(--fintheon-accent)]/45 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>
      <DeskPlanInlineWidget
        plan={event.plan}
        window={event.window}
        isOpen={isExpanded}
        compact={compact}
      />
    </article>
  );
}
