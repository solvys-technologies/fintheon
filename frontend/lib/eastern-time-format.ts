// [claude-code 2026-05-18] App-wide Eastern 12h display helpers.
const EASTERN_TIME_ZONE = "America/New_York";

function withEastern12h(options?: Intl.DateTimeFormatOptions) {
  return {
    ...options,
    timeZone: EASTERN_TIME_ZONE,
    hour12: true,
  };
}

export function formatEasternTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatEasternClock(value: string): string {
  const [hourRaw, minuteRaw = "00"] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return formatEasternTime(date).replace(/\s/g, "");
}

export function formatEasternClockRange(start: string, end: string): string {
  return `${formatEasternClock(start)}-${formatEasternClock(end)}`;
}

export function installEasternTimeFormatOverride(): void {
  if (typeof window === "undefined") return;
  const proto = Date.prototype as Date & {
    __fintheonEasternTimeOverride?: boolean;
  };
  if (proto.__fintheonEasternTimeOverride) return;

  const originalTime = Date.prototype.toLocaleTimeString;
  const originalString = Date.prototype.toLocaleString;

  Date.prototype.toLocaleTimeString = function (
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ) {
    return originalTime.call(this, locales || "en-US", withEastern12h(options));
  };

  Date.prototype.toLocaleString = function (
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ) {
    return originalString.call(this, locales || "en-US", withEastern12h(options));
  };

  proto.__fintheonEasternTimeOverride = true;
}
