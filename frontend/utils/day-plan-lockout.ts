import type { DayPlanWindow } from "../types/day-plan";

export interface DeskPlanLockoutDecision {
  isAllowed: boolean;
  lockUntil: string | null;
}

interface DecisionParams {
  planDate: string;
  windows: DayPlanWindow[];
  autoReleaseMinutes: number;
  now?: Date;
}

export function getDeskPlanLockoutDecision({
  planDate,
  windows,
  autoReleaseMinutes,
  now = new Date(),
}: DecisionParams): DeskPlanLockoutDecision {
  const sortedWindows = [...windows].sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  );

  for (const window of sortedWindows) {
    const start = parsePlanDateTime(planDate, window.startTime);
    const end = parsePlanDateTime(planDate, window.endTime);
    const release = new Date(
      start.getTime() - Math.max(0, autoReleaseMinutes) * 60_000,
    );

    if (now >= release && now <= end) {
      return { isAllowed: true, lockUntil: null };
    }

    if (now < release) {
      return { isAllowed: false, lockUntil: release.toISOString() };
    }
  }

  return {
    isAllowed: false,
    lockUntil: getNextDeskPlanMorning(planDate).toISOString(),
  };
}

export function getDayPlanHeading(date: string | null | undefined): string {
  if (!date) return "TRADING WINDOW";
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return "TRADING WINDOW";
  return new Date(year, month - 1, day)
    .toLocaleDateString(undefined, { weekday: "long" })
    .toUpperCase();
}

function parsePlanDateTime(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours ?? 0, minutes ?? 0, 0, 0);
}

function getNextDeskPlanMorning(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day + 1, 6, 0, 0, 0);
}
