import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { formatEasternClockRange } from "../../lib/eastern-time-format";
import { cn } from "../../lib/utils";
import { FadingRuler } from "../shared/FadingRuler";
import type { DayPlan, DayPlanWindow } from "../../types/day-plan";
import { DeskPlanInlineWidget } from "../desk/DeskPlanInlineWidget";
import { EmptyTimeline } from "./DeskPlanMapEmptyStates";
import {
  formatClock,
  sprintOverlap,
  type SprintSegment,
} from "./DeskPlanMapUtils";
import { DeletePlanButton } from "./DeskPlanDeleteButton";

const POP_OUT_CARD =
  "desk-sprint-event-card relative overflow-hidden transition-[transform,border-color,background-color,box-shadow,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform hover:-translate-y-0.5 hover:scale-[1.006] active:translate-y-0 active:scale-[0.995]";

interface SprintBlockItem {
  plan: DayPlan;
  window: DayPlanWindow;
  overlap: { left: number; width: number };
}

export function DeskPlanSprintTimeline({
  plans,
  segments,
  segmentIndex,
  transitionDirection,
  deletingId,
  onDelete,
}: {
  plans: DayPlan[];
  segments: SprintSegment[];
  segmentIndex: number;
  transitionDirection?: number;
  deletingId: string | null;
  onDelete: (plan: DayPlan) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const segment = segments[segmentIndex] ?? segments[0];
  const weekRows = useMemo(
    () => (segment ? buildWeekRows(plans, segment) : []),
    [plans, segment],
  );

  if (plans.length === 0 || !segment) return <EmptyTimeline />;

  const blockCount = weekRows.reduce(
    (count, row) => count + row.blocks.length,
    0,
  );
  const motionClass =
    transitionDirection && transitionDirection < 0
      ? "animate-in fade-in slide-in-from-left-1 duration-200"
      : "animate-in fade-in slide-in-from-right-1 duration-200";

  return (
    <div className={cn("flex h-full min-h-0 flex-col", motionClass)}>
      <div className="flex items-end justify-between gap-4 pb-2">
        <p className="font-mono text-[10px] text-[var(--fintheon-accent)]">
          {segment.dateLabel}
        </p>
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]/45">
          {blockCount} blocks
        </p>
      </div>
      <FadingRuler className="opacity-35" />

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-[62px_1fr] gap-2">
          <span />
          <TimeRuler segment={segment} />
        </div>
        <div className="relative mt-2">
          <TimeGuides segment={segment} />
          {weekRows.map((row) => (
            <div key={row.date}>
              <SprintDayRow
                row={row}
                expandedId={expandedId}
                deletingId={deletingId}
                onDelete={onDelete}
                onToggle={(blockId) =>
                  setExpandedId((current) =>
                    current === blockId ? null : blockId,
                  )
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SprintDayRow({
  row,
  expandedId,
  deletingId,
  onDelete,
  onToggle,
}: {
  row: WeekRow;
  expandedId: string | null;
  deletingId: string | null;
  onDelete: (plan: DayPlan) => void;
  onToggle: (blockId: string) => void;
}) {
  const expandedBlockIndex = row.blocks.findIndex(
    (item) => `${item.plan.id}-${item.window.id}` === expandedId,
  );
  const hasExpandedBlock = expandedBlockIndex >= 0;
  const rowHeight = Math.max(
    62,
    row.blocks.length * 42 + 14 + (hasExpandedBlock ? 172 : 0),
  );
  return (
    <div
      className="relative grid grid-cols-[62px_1fr] gap-2 py-2"
      style={{ minHeight: rowHeight }}
    >
      <div className="pt-1 text-right">
        <p
          className="text-[13px] uppercase leading-none text-[var(--fintheon-accent)]/82"
          style={{ fontFamily: "var(--font-display, var(--font-heading))" }}
        >
          {row.day}
        </p>
        <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]/42">
          {row.shortDate}
        </p>
      </div>
      <div className="relative min-h-[72px]">
        {row.blocks.length === 0 ? (
          <p className="pt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)]/28">
            Open
          </p>
        ) : (
          row.blocks.map((item, index) => {
            const blockId = `${item.plan.id}-${item.window.id}`;
            const top =
              index * 42 +
              (hasExpandedBlock && index > expandedBlockIndex ? 172 : 0);
            return (
              <SprintBlock
                key={blockId}
                plan={item.plan}
                window={item.window}
                overlap={item.overlap}
                top={top}
                isExpanded={expandedId === blockId}
                deletingId={deletingId}
                onDelete={onDelete}
                onToggle={() => onToggle(blockId)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function SprintBlock({
  plan,
  window,
  overlap,
  top,
  isExpanded,
  deletingId,
  onDelete,
  onToggle,
}: {
  plan: DayPlan;
  window: DayPlanWindow;
  overlap: { left: number; width: number };
  top: number;
  isExpanded: boolean;
  deletingId: string | null;
  onDelete: (plan: DayPlan) => void;
  onToggle: () => void;
}) {
  const tone = getWindowTone(window);
  const visualWidth = isExpanded
    ? Math.min(72, Math.max(44, overlap.width))
    : Math.min(overlap.width, 92);
  const visualLeft = Math.max(0, Math.min(overlap.left, 100 - visualWidth));
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onToggle();
      }}
      data-expanded={isExpanded ? "true" : "false"}
      className={cn(
        POP_OUT_CARD,
        "absolute min-w-[138px] p-2 text-left",
        isExpanded && "z-30",
      )}
      style={{
        left: `${visualLeft}%`,
        top,
        width: `${visualWidth}%`,
        borderColor: tone.color,
        ["--desk-event-tone" as string]: tone.color,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute right-0 top-0 h-0 w-0 border-l-[12px] border-t-[12px] border-l-transparent"
        style={{ borderTopColor: tone.color }}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-1 text-[10.5px] text-[var(--fintheon-text)]/90">
            {window.eventName ?? plan.eventName ?? "Desk session"}
          </p>
          <p className="mt-0.5 font-mono text-[7.5px] text-[var(--fintheon-accent)]/65">
            {formatEasternClockRange(window.startTime, window.endTime)}
          </p>
          <p className="font-mono text-[7.5px] text-[var(--fintheon-accent)]/55">
            Fcst {window.econForecast?.forecast ?? "pending"}
          </p>
        </div>
        <div
          className="flex shrink-0 items-center gap-1 pr-2"
          onClick={(event) => event.stopPropagation()}
        >
          <DeletePlanButton
            plan={plan}
            deletingId={deletingId}
            onDelete={onDelete}
          />
          {isExpanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </div>
      </div>
      <DeskPlanInlineWidget plan={plan} window={window} isOpen={isExpanded} />
    </div>
  );
}

function TimeRuler({ segment }: { segment: SprintSegment }) {
  return (
    <div className="relative grid grid-cols-5 text-center">
      {[0, 60, 120, 180, 240].map((offset) => (
        <span
          key={offset}
          className="text-[12px] uppercase text-[var(--fintheon-muted)]/52"
          style={{ fontFamily: "var(--font-display, var(--font-data))" }}
        >
          {formatClock(segment.startMinute + offset)}
        </span>
      ))}
    </div>
  );
}

function TimeGuides({ segment }: { segment: SprintSegment }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 left-[70px]"
    >
      {[0, 60, 120, 180, 240].map((offset) => {
        const left =
          ((segment.startMinute + offset - segment.startMinute) /
            (segment.endMinute - segment.startMinute)) *
          100;
        return (
          <span
            key={offset}
            className="absolute top-0 h-full w-px"
            style={{
              left: `${left}%`,
              background:
                "linear-gradient(to bottom, color-mix(in srgb, var(--fintheon-accent) 18%, transparent) 0%, color-mix(in srgb, var(--fintheon-accent) 18%, transparent) 35%, color-mix(in srgb, var(--fintheon-accent) 8%, transparent) 72%, transparent 100%)",
            }}
          />
        );
      })}
    </div>
  );
}

interface WeekRow {
  date: string;
  day: string;
  shortDate: string;
  blocks: SprintBlockItem[];
}

function buildWeekRows(plans: DayPlan[], segment: SprintSegment): WeekRow[] {
  const weekDates = getWeekDates(segment.date);
  const planMap = new Map<string, DayPlan[]>();
  for (const plan of plans) {
    const list = planMap.get(plan.date) ?? [];
    list.push(plan);
    planMap.set(plan.date, list);
  }

  return weekDates.map((date) => {
    const datePlans = planMap.get(date) ?? [];
    const blocks = datePlans
      .flatMap((plan) =>
        (plan.windows ?? [])
          .map((window) => ({
            plan,
            window,
            overlap: sprintOverlap(window.startTime, window.endTime, {
              ...segment,
              date,
              plans: datePlans,
            }),
          }))
          .filter(
            (
              item,
            ): item is {
              plan: DayPlan;
              window: DayPlanWindow;
              overlap: { left: number; width: number };
            } => item.overlap != null,
          ),
      )
      .sort((a, b) => a.window.startTime.localeCompare(b.window.startTime));
    return {
      date,
      day: formatDay(date),
      shortDate: formatShortDate(date),
      blocks,
    };
  });
}

function getWeekDates(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const cursor = new Date(year, month - 1, day);
  const dayOfWeek = cursor.getDay() || 7;
  cursor.setDate(cursor.getDate() - dayOfWeek + 1);
  return Array.from({ length: 5 }, () => {
    const iso = [
      cursor.getFullYear(),
      String(cursor.getMonth() + 1).padStart(2, "0"),
      String(cursor.getDate()).padStart(2, "0"),
    ].join("-");
    cursor.setDate(cursor.getDate() + 1);
    return iso;
  });
}

function formatDay(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
  });
}

function formatShortDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
  });
}

function getWindowTone(window: DayPlanWindow) {
  const metadata = window as DayPlanWindow & {
    importance?: string | number | null;
    impact?: string | number | null;
    severity?: string | number | null;
  };
  const raw = String(
    metadata.importance ?? metadata.impact ?? metadata.severity ?? "",
  ).toLowerCase();
  if (/(critical|high|3)/.test(raw)) {
    return { color: "var(--fintheon-bearish)", label: "High" };
  }
  if (/(medium|moderate|2)/.test(raw)) {
    return { color: "var(--fintheon-accent)", label: "Med" };
  }
  if (/(low|1)/.test(raw)) {
    return { color: "var(--fintheon-bullish)", label: "Low" };
  }

  const miss = window.econForecast?.miss.probability ?? 0;
  const beat = window.econForecast?.beat.probability ?? 0;
  const peak = Math.max(miss, beat);
  if (peak >= 65) return { color: "var(--fintheon-bearish)", label: "High" };
  if (peak >= 45) return { color: "var(--fintheon-accent)", label: "Med" };
  return { color: "var(--fintheon-muted)", label: "Low" };
}
