import { GripHorizontal } from "lucide-react";
import type { DayPlan } from "../../types/day-plan";
import { formatClock, sprintOverlap, type SprintSegment } from "./DeskPlanMapUtils";

export function DeskPlanRelativeScrubber({
  segments,
  segmentIndex,
  onSegmentIndexChange,
}: {
  segments: SprintSegment[];
  segmentIndex: number;
  onSegmentIndexChange: (index: number) => void;
}) {
  if (segments.length === 0) return null;

  const segment = segments[segmentIndex] ?? segments[0];
  const baseDate = segments[0]?.date ?? segment.date;

  return (
    <div
      className="mt-3 shrink-0 px-1 pb-1 pt-3"
      style={{
        backgroundImage:
          "linear-gradient(to right, transparent, rgba(199,159,74,0.14), transparent)",
        backgroundPosition: "left top",
        backgroundRepeat: "no-repeat",
        backgroundSize: "100% 1px",
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]/45">
          {relativeDateLabel(baseDate, segment.date)} / {segment.label} ET
        </span>
        <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/65">
          {segmentIndex + 1}/{segments.length}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-[var(--fintheon-muted)]/45" />
        <div className="relative h-6 flex-1">
          <div className="absolute inset-x-0 top-2 flex h-2 overflow-hidden rounded-sm">
            {segments.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSegmentIndexChange(index)}
                className="h-full flex-1 transition-opacity hover:opacity-100"
                style={{
                  background: segmentHeat(item.plans, item),
                  opacity: index === segmentIndex ? 0.95 : 0.34,
                }}
                title={`${relativeDateLabel(baseDate, item.date)} ${item.label}`}
              />
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, segments.length - 1)}
            value={segmentIndex}
            onChange={(event) => onSegmentIndexChange(Number(event.target.value))}
            className="absolute inset-x-0 top-0 h-6 w-full cursor-ew-resize opacity-0"
            aria-label="Scrub Desk Plan timeline"
          />
          <div
            className="pointer-events-none absolute top-0 h-6 w-px bg-[var(--fintheon-accent)]/80"
            style={{
              left: `${segments.length <= 1 ? 0 : (segmentIndex / (segments.length - 1)) * 100}%`,
            }}
          />
        </div>
        <span className="shrink-0 font-mono text-[8px] text-[var(--fintheon-muted)]/40">
          {formatClock(segment.startMinute)}
        </span>
      </div>
    </div>
  );
}

function segmentHeat(plans: DayPlan[], segment: SprintSegment) {
  const windows = plans.flatMap((plan) => plan.windows ?? []);
  const active = windows.filter((window) =>
    sprintOverlap(window.startTime, window.endTime, segment),
  );
  if (active.length >= 2) return "rgba(199,159,74,0.92)";
  if (active.length === 1) return "rgba(20,184,166,0.72)";
  return "rgba(107,114,128,0.28)";
}

function relativeDateLabel(baseDate: string, date: string) {
  const base = Date.parse(`${baseDate}T00:00:00`);
  const next = Date.parse(`${date}T00:00:00`);
  if (!Number.isFinite(base) || !Number.isFinite(next)) return date;
  const days = Math.round((next - base) / 86400000);
  if (days === 0) return "D0";
  return days > 0 ? `D+${days}` : `D${days}`;
}
