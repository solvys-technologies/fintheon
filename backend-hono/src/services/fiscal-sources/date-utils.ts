// [claude-code 2026-04-24] S34-T7: ET date/time normalization shared across fiscal scrapers.

const ET = "America/New_York";

function part(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

/**
 * Project an absolute timestamp into ET date + 24h time strings.
 * Returns null when the input is unparseable. Time is "00:00" when the source
 * didn't give one (all-day events).
 */
export function toEtParts(
  input: Date | string | undefined,
): { date: string; time: string } | null {
  if (!input) return null;
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return null;

  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: ET,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const date = `${part(dateFmt, "year")}-${part(dateFmt, "month")}-${part(
    dateFmt,
    "day",
  )}`;

  const timeFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: ET,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hh = part(timeFmt, "hour");
  const mm = part(timeFmt, "minute");
  const time = `${hh === "24" ? "00" : hh}:${mm}`;

  return { date, time };
}

export function todayEt(): string {
  return toEtParts(new Date())?.date ?? new Date().toISOString().slice(0, 10);
}

/**
 * Only keep events dated today or in the future (ET). Speakers in the past
 * aren't useful for the countdown modal; purge them early.
 */
export function isFutureOrToday(date: string): boolean {
  return date >= todayEt();
}
