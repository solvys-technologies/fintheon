import { formatEasternClockRange } from "../../lib/eastern-time-format";
import type { DayPlan, DayPlanWindow } from "../../types/day-plan";

export interface QueuedDeskEvent {
  id: string;
  plan: DayPlan;
  window: DayPlanWindow;
  date: string;
  dateLabel: string;
  title: string;
  timeRange: string;
  country: string;
  forecast: string;
  prediction: string;
  missPrint: string | null;
  beatPrint: string | null;
}

export function buildQueuedDeskEvents(plans: DayPlan[]): QueuedDeskEvent[] {
  return plans
    .flatMap((plan) =>
      (plan.windows ?? []).map((window) => ({
        id: `${plan.id}:${window.id}`,
        plan,
        window,
        date: plan.date,
        dateLabel: formatDeskDate(plan.date),
        title: window.eventName ?? plan.eventName ?? "Desk event",
        timeRange: formatEasternClockRange(window.startTime, window.endTime),
        country:
          window.eventCountry ?? window.econForecast?.eventCountry ?? "Desk",
        forecast: window.econForecast?.forecast ?? "pending",
        prediction:
          window.econForecast?.aiPrediction ??
          plan.deskTheme ??
          "Awaiting desk forecast.",
        missPrint: window.econForecast
          ? scenarioPrint(
              window.econForecast.forecast,
              window.econForecast.miss.agenticPrint,
              "miss",
            )
          : null,
        beatPrint: window.econForecast
          ? scenarioPrint(
              window.econForecast.forecast,
              window.econForecast.beat.agenticPrint,
              "beat",
            )
          : null,
      })),
    )
    .sort((a, b) => {
      const dateSort = a.date.localeCompare(b.date);
      if (dateSort !== 0) return dateSort;
      return a.window.startTime.localeCompare(b.window.startTime);
    });
}

function scenarioPrint(
  forecast: string,
  explicitValue: string | undefined,
  side: "miss" | "beat",
) {
  const explicit = explicitValue?.trim();
  if (explicit) return explicit;
  const clean = forecast.trim();
  if (!clean || /^(n\/?a|null|undefined)$/i.test(clean)) return "\u2014";
  const lower = clean.toLowerCase();
  if (lower === "hawkish" || lower === "dovish" || lower === "none") {
    if (side === "miss") return lower === "hawkish" ? "dovish" : lower;
    return lower === "dovish" ? "hawkish" : lower;
  }
  if (/^[<>≤≥]/.test(clean)) return clean;
  return `${side === "miss" ? "<" : ">"}${clean}`;
}

export function groupQueuedDeskEvents(events: QueuedDeskEvent[]) {
  const groups = new Map<string, QueuedDeskEvent[]>();
  for (const event of events) {
    const list = groups.get(event.date) ?? [];
    list.push(event);
    groups.set(event.date, list);
  }
  return Array.from(groups.entries()).map(([date, items]) => ({
    date,
    label: items[0]?.dateLabel ?? formatDeskDate(date),
    items,
  }));
}

export function countQueuedWindows(plans: DayPlan[]) {
  return plans.reduce((count, plan) => count + (plan.windows?.length ?? 0), 0);
}

function formatDeskDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
