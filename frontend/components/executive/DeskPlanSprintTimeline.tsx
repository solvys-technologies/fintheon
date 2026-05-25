import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { formatEasternClockRange } from "../../lib/eastern-time-format";
import { cn } from "../../lib/utils";
import { FadingRuler } from "../shared/FadingRuler";
import type { DayPlan, DayPlanWindow } from "../../types/day-plan";
import { EmptyTimeline } from "./DeskPlanMapEmptyStates";
import {
  formatClock,
  sprintOverlap,
  type SprintSegment,
} from "./DeskPlanMapUtils";
import { DeletePlanButton } from "./DeskPlanDeleteButton";

const POP_OUT_CARD =
  "fintheon-liquid-surface transition-[transform,border-color,background-color,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform hover:-translate-y-1 hover:scale-[1.01] hover:border-[var(--fintheon-accent)]/25 active:translate-y-0 active:scale-[0.995]";

export function DeskPlanSprintTimeline({
  plans,
  segments,
  segmentIndex,
  deletingId,
  onDelete,
}: {
  plans: DayPlan[];
  segments: SprintSegment[];
  segmentIndex: number;
  deletingId: string | null;
  onDelete: (plan: DayPlan) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const segment = segments[segmentIndex] ?? segments[0];

  if (plans.length === 0 || !segment) return <EmptyTimeline />;

  const blocks = segment.plans.flatMap((plan) =>
    (plan.windows ?? [])
      .map((window) => ({ plan, window, overlap: sprintOverlap(window.startTime, window.endTime, segment) }))
      .filter((item) => item.overlap != null),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-end justify-between gap-4 pb-3">
        <div>
          <p className="font-mono text-[10px] text-[var(--fintheon-accent)]">
            {segment.dateLabel}
          </p>
          <h3 className="mt-1 text-[13px] uppercase tracking-[0.18em] text-[var(--fintheon-text)]/85">
            {segment.label} ET
          </h3>
        </div>
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]/45">
          {blocks.length} blocks
        </p>
      </div>
      <FadingRuler className="opacity-35" />

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        <TimeRuler segment={segment} />
        {blocks.length === 0 ? (
          <BlankSegment segment={segment} />
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {blocks.map((item, index) => {
              const blockId = `${item.plan.id}-${item.window.id}`;
              return (
                <div key={blockId} className="flex flex-col gap-3">
                  <SprintBlock
                    plan={item.plan}
                    window={item.window}
                    overlap={item.overlap!}
                    isExpanded={expandedId === blockId}
                    deletingId={deletingId}
                    onDelete={onDelete}
                    onToggle={() =>
                      setExpandedId((current) => (current === blockId ? null : blockId))
                    }
                  />
                  {index < blocks.length - 1 ? <SprintLaneDivider /> : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

function SprintLaneDivider() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-[86px_1fr] gap-3"
    >
      <span />
      <FadingRuler className="opacity-30" />
    </div>
  );
}

function SprintBlock({
  plan,
  window,
  overlap,
  isExpanded,
  deletingId,
  onDelete,
  onToggle,
}: {
  plan: DayPlan;
  window: DayPlanWindow;
  overlap: { left: number; width: number };
  isExpanded: boolean;
  deletingId: string | null;
  onDelete: (plan: DayPlan) => void;
  onToggle: () => void;
}) {
  return (
    <div className="grid min-h-[82px] grid-cols-[86px_1fr] gap-3">
      <div className="pt-2 text-right">
        <p className="font-mono text-[9px] text-[var(--fintheon-accent)]/70">
          {formatEasternClockRange(window.startTime, window.endTime)}
        </p>
        <p className="mt-1 text-[8px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)]/35">
          {window.eventCountry ?? "Desk"}
        </p>
      </div>
      <div className="relative min-h-[82px] rounded border border-[var(--fintheon-accent)]/[0.06] bg-[var(--fintheon-bg)]/[0.28]">
        <div
          role="button"
          tabIndex={0}
          onClick={onToggle}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onToggle();
          }}
          className={cn(POP_OUT_CARD, "absolute top-2 min-w-[170px] p-3 text-left")}
          style={{ left: `${overlap.left}%`, width: `${Math.min(overlap.width, 92)}%` }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="line-clamp-1 text-[12px] text-[var(--fintheon-text)]/90">
                {window.eventName ?? plan.eventName ?? "Desk session"}
              </p>
              <p className="mt-1 font-mono text-[9px] text-[var(--fintheon-accent)]/65">
                Fcst {window.econForecast?.forecast ?? "pending"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <DeletePlanButton plan={plan} deletingId={deletingId} onDelete={onDelete} />
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </div>
          </div>
          {isExpanded ? (
            <p className="mt-3 text-[10px] leading-relaxed text-[var(--fintheon-text)]/62">
              {window.econForecast?.aiPrediction ?? plan.deskTheme ?? "Awaiting agent forecast."}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TimeRuler({ segment }: { segment: SprintSegment }) {
  return (
    <div className="ml-[98px] grid grid-cols-5 text-center font-mono text-[8px] text-[var(--fintheon-muted)]/40">
      {[0, 60, 120, 180, 240].map((offset) => (
        <span key={offset}>{formatClock(segment.startMinute + offset)}</span>
      ))}
    </div>
  );
}

function BlankSegment({ segment }: { segment: SprintSegment }) {
  return (
    <div className="mt-3 grid min-h-[180px] grid-cols-[86px_1fr] gap-3">
      <div className="pt-2 text-right font-mono text-[9px] text-[var(--fintheon-muted)]/35">
        Open
      </div>
      <div className="rounded border border-dashed border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-surface)]/[0.35] p-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]/35">
          [NO DESK PLAN]
        </p>
        <p className="mt-2 text-[10px] leading-relaxed text-[var(--fintheon-muted)]/45">
          {segment.label} ET is open until an event is added.
        </p>
      </div>
    </div>
  );
}
