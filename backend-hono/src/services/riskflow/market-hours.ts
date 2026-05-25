// [claude-code 2026-05-12] Market hours check — regular trading hours vs after-hours for X polling throttling.
// RTH: 09:30 ET — 16:00 ET. Outside that window = after-hours (including pre-market).
// ET is America/New_York.

export function isRegularTradingHours(): boolean {
  const now = minutesInET(new Date());
  // RTH close at 16:00 ET (960 min), open at 09:30 ET (570 min)
  return now >= 570 && now < 960;
}

export function isAfterHours(): boolean {
  return !isRegularTradingHours();
}

function minutesInET(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const hh = h === 24 ? 0 : h;
  return hh * 60 + m;
}

export function getCurrentETHoursMinutes(): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { hour: h === 24 ? 0 : h, minute: m };
}
