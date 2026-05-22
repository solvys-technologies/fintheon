import type { DayPlan } from "../../types/day-plan";

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
    dates.push(cursor.toISOString().slice(0, 10));
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
