export interface DeskCalendarQueueEvent {
  id: string;
  starts_at: string;
  ends_at: string | null;
  title: string;
  description: string | null;
  severity: number | null;
}

export interface DeskWeekPlanEvent {
  id: string;
  day: string;
  date: string;
  title: string;
  eventTime: string;
  window: string;
  forecast: string;
  severity: number | null;
}

export const PENDING_CHAT_PROMPT_KEY = "fintheon:pending-chat-prompt";
export const DAY_PLAN_MULTI_REFETCH_EVENT = "fintheon:day-plan-multi-refetch";

export function toDeskWeekPlanEvents(
  events: DeskCalendarQueueEvent[],
): DeskWeekPlanEvent[] {
  return events.map((event) => {
    const start = new Date(event.starts_at);
    const end = event.ends_at
      ? new Date(event.ends_at)
      : new Date(start.getTime() + 90 * 60_000);
    const windowStart = new Date(start.getTime() - 45 * 60_000);
    return {
      id: event.id,
      day: formatEtDate(start, { weekday: "short" }),
      date: formatEtIsoDate(start),
      title: cleanTitle(event.title),
      eventTime: formatEtTime(start),
      window: `${formatEtTime(windowStart)}-${formatEtTime(end)}`,
      forecast: extractField(event.description, "forecast") ?? "pending",
      severity: event.severity,
    };
  });
}

export function buildWeeklyDeskPlanPrompt(events: DeskWeekPlanEvent[]): string {
  const table = buildMarkdownTable(events);
  const slotPayload = JSON.stringify({ events }, null, 2);
  return [
    "Build the weekly desk plan from the queued econ calendar events below.",
    "Use CIO/CAO judgment: remove weak events, tighten trading windows, and call out any dead-calendar gaps.",
    "Return a concise weekly plan and include the exact `weekly-desk-plan` preview block so I can approve or deny it.",
    "",
    table,
    "",
    "```weekly-desk-plan",
    slotPayload,
    "```",
  ].join("\n");
}

export function storePendingChatPrompt(prompt: string): void {
  try {
    localStorage.setItem(PENDING_CHAT_PROMPT_KEY, prompt);
  } catch {
    /* storage unavailable */
  }
}

export function consumePendingChatPrompt(): string | null {
  try {
    const prompt = localStorage.getItem(PENDING_CHAT_PROMPT_KEY);
    if (prompt) localStorage.removeItem(PENDING_CHAT_PROMPT_KEY);
    return prompt;
  } catch {
    return null;
  }
}

function buildMarkdownTable(events: DeskWeekPlanEvent[]): string {
  const rows = events.map((event) =>
    [
      event.day,
      event.title.replace(/\|/g, "/"),
      event.eventTime,
      event.window,
      event.forecast.replace(/\|/g, "/"),
    ].join(" | "),
  );
  return [
    "| Day | Event | Time | Trading Window | Forecast |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row} |`),
  ].join("\n");
}

function formatEtIsoDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatEtTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .replace(/\s/g, "");
}

function formatEtDate(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    ...options,
  }).format(date);
}

function cleanTitle(title: string): string {
  return title
    .replace(/^\s*([A-Z]{2,3}|USA|United States)\s*[-:]\s*/i, "")
    .trim();
}

function extractField(
  description: string | null,
  label: string,
): string | null {
  if (!description) return null;
  const match = description.match(
    new RegExp(`${label}\\s*[:：]\\s*([^\\n|]+)`, "i"),
  );
  return match?.[1]?.trim() || null;
}
