import type { DayPlan } from "../../types/day-plan";

export interface SprintSegment {
  id: string;
  date: string;
  dateLabel: string;
  startMinute: number;
  endMinute: number;
  label: string;
  plans: DayPlan[];
}

export function sortPlans(plans: DayPlan[]): DayPlan[] {
  return [...plans].sort((a, b) => a.date.localeCompare(b.date));
}

export function buildCalendarDays(plans: DayPlan[]) {
  const map = new Map<string, DayPlan[]>();
  for (const plan of plans) {
    const list = map.get(plan.date) ?? [];
    list.push(plan);
    map.set(plan.date, list);
  }
  const dateSet = new Set(nextFiveDays());
  for (const plan of plans) dateSet.add(plan.date);
  return Array.from(dateSet)
    .sort()
    .slice(0, 5)
    .map((date) => ({
      date,
      plans: map.get(date) ?? [],
    }));
}

export function nextFiveDays(): string[] {
  const dates: string[] = [];
  const cursor = new Date();
  while (dates.length < 5) {
    const day = cursor.getDay();
    if (day >= 1 && day <= 5) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function buildSprintSegments(plans: DayPlan[]): SprintSegment[] {
  const calendarDays = buildCalendarDays(plans);
  return calendarDays.flatMap((day) =>
    [0, 4, 8, 12, 16, 20].map((hour) => ({
      id: `${day.date}-${hour}`,
      date: day.date,
      dateLabel: formatDate(day.date),
      startMinute: hour * 60,
      endMinute: (hour + 4) * 60,
      label: `${formatClock(hour * 60)} - ${formatClock((hour + 4) * 60)}`,
      plans: day.plans,
    })),
  );
}

export function parseClockMinutes(
  clock: string | null | undefined,
): number | null {
  if (!clock) return null;
  const [hours, minutes] = clock.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function formatClock(minutes: number): string {
  const bounded = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(bounded / 60);
  const mins = bounded % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(mins).padStart(2, "0")} ${suffix}`;
}

export function sprintOverlap(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  segment: SprintSegment,
) {
  const start = parseClockMinutes(startTime);
  const end = parseClockMinutes(endTime);
  if (start == null || end == null) return null;
  const overlapStart = Math.max(start, segment.startMinute);
  const overlapEnd = Math.min(end, segment.endMinute);
  if (overlapEnd <= overlapStart) return null;
  const span = segment.endMinute - segment.startMinute;
  return {
    left: ((overlapStart - segment.startMinute) / span) * 100,
    width: Math.max(10, ((overlapEnd - overlapStart) / span) * 100),
  };
}

export function segmentHasWindows(segment: SprintSegment): boolean {
  return segment.plans.some((plan) =>
    plan.windows?.some((window) => windowBelongsToSegment(window, segment)),
  );
}

function windowBelongsToSegment(
  window: { startTime?: string | null; endTime?: string | null },
  segment: SprintSegment,
) {
  const start = parseClockMinutes(window.startTime);
  const end = parseClockMinutes(window.endTime);
  if (start == null || end == null) return false;
  const adjustedEnd = end < start ? end + 24 * 60 : end;
  const center = start + (adjustedEnd - start) / 2;
  return center >= segment.startMinute && center < segment.endMinute;
}

export function findNextDeskPlanSegmentIndex(
  segments: SprintSegment[],
  now = new Date(),
): number {
  if (segments.length === 0) return 0;
  const current = currentEtKey(now);
  const futureIndex = segments.findIndex(
    (segment) => segmentHasWindows(segment) && segmentKey(segment) >= current,
  );
  if (futureIndex >= 0) return futureIndex;
  const firstPopulated = segments.findIndex(segmentHasWindows);
  return firstPopulated >= 0 ? firstPopulated : 0;
}

function segmentKey(segment: SprintSegment): string {
  return `${segment.date}:${String(segment.endMinute).padStart(4, "0")}`;
}

function currentEtKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  return `${get("year")}-${get("month")}-${get("day")}:${String(minutes).padStart(4, "0")}`;
}
