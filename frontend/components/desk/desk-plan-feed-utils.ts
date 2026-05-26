import type { DayPlan, DayPlanWindow } from "../../types/day-plan";

const EASTERN_TIME_ZONE = "America/New_York";

export interface DeskPlanFeedItem {
  id: string;
  planId: string;
  date: string;
  dateLabel: string;
  timeRange: string;
  title: string;
  forecast: string;
  prediction: string;
  country: string;
  probability: number | null;
  direction: "bullish" | "bearish" | "neutral";
  sortKey: string;
  endKey: string;
}

export function buildUpcomingDeskPlanFeed(
  plans: DayPlan[],
  now = new Date(),
): DeskPlanFeedItem[] {
  const nowKey = easternNowKey(now);
  return plans
    .flatMap(planToFeedItems)
    .filter((item) => item.endKey >= nowKey)
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

function planToFeedItems(plan: DayPlan): DeskPlanFeedItem[] {
  if (plan.windows.length === 0) return [planOnlyItem(plan)];

  return plan.windows.map((window) => windowToItem(plan, window));
}

function windowToItem(plan: DayPlan, window: DayPlanWindow): DeskPlanFeedItem {
  const startTime = normalizeClock(window.startTime);
  const endTime = normalizeClock(window.endTime);
  const endDate = endTime < startTime ? addDays(plan.date, 1) : plan.date;
  const forecast = window.econForecast;
  const scenario =
    forecast && forecast.miss.probability >= forecast.beat.probability
      ? forecast.miss
      : forecast?.beat;

  return {
    id: `${plan.id}-${window.id}`,
    planId: plan.id,
    date: plan.date,
    dateLabel: formatPlanDate(plan.date),
    timeRange: `${formatClock(startTime)}-${formatClock(endTime)}`,
    title: window.eventName ?? plan.eventName ?? "Desk session",
    forecast: forecast?.forecast ?? "Forecast pending",
    prediction:
      forecast?.aiPrediction ?? plan.deskTheme ?? "Awaiting desk read.",
    country: window.eventCountry ?? forecast?.eventCountry ?? "Desk",
    probability: scenario?.probability ?? null,
    direction: scenario?.isBullishForEquities
      ? "bullish"
      : scenario
        ? "bearish"
        : "neutral",
    sortKey: `${plan.date}T${startTime}`,
    endKey: `${endDate}T${endTime}`,
  };
}

function planOnlyItem(plan: DayPlan): DeskPlanFeedItem {
  return {
    id: plan.id,
    planId: plan.id,
    date: plan.date,
    dateLabel: formatPlanDate(plan.date),
    timeRange: "Open",
    title: plan.eventName ?? "Desk plan",
    forecast: "Schedule pending",
    prediction: plan.deskTheme ?? "Add a desk window to activate this plan.",
    country: "Desk",
    probability: null,
    direction: "neutral",
    sortKey: `${plan.date}T23:59`,
    endKey: `${plan.date}T23:59`,
  };
}

function easternNowKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

function normalizeClock(value: string): string {
  const [hourRaw = "00", minuteRaw = "00"] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "00:00";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatClock(value: string): string {
  const [hourRaw, minuteRaw] = normalizeClock(value).split(":");
  const hour = Number(hourRaw);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minuteRaw}${suffix}`;
}

function formatPlanDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString(
    "en-US",
    {
      timeZone: EASTERN_TIME_ZONE,
      weekday: "short",
      month: "short",
      day: "numeric",
    },
  );
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days, 12));
  return next.toISOString().slice(0, 10);
}
