// [claude-code 2026-03-06] Time utilities for Regime Tracker — ET timezone handling, active checks, countdowns
// [claude-code 2026-03-12] Added formatTime12H for 12-hour NY time display

import type { TradingRegime } from './regimes';

const ET_TZ = 'America/New_York';

/** Convert HH:MM (24H) to 12H format (e.g. "09:30" → "9:30 AM", "14:00" → "2:00 PM") */
export function formatTime12H(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Format a time range in 12H (e.g. "9:30 AM - 9:45 AM NY") */
export function formatTimeRange12H(start: string, end: string): string {
  return `${formatTime12H(start)} - ${formatTime12H(end)} NY`;
}

export function getCurrentETTime(): Date {
  const now = new Date();
  const etStr = now.toLocaleString('en-US', { timeZone: ET_TZ });
  return new Date(etStr);
}

function getETDayOfWeek(now: Date): TradingRegime['daysActive'][number] {
  const days: TradingRegime['daysActive'][number][] = ['Sun' as any, 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' as any];
  return days[now.getDay()];
}

function parseHHMM(hhmm: string): { hours: number; minutes: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { hours: h, minutes: m };
}

function toMinutesOfDay(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

export function isRegimeActive(regime: TradingRegime, now?: Date): boolean {
  const et = now ?? getCurrentETTime();
  const dayName = getETDayOfWeek(et);

  if (!regime.daysActive.includes(dayName)) return false;

  const currentMins = toMinutesOfDay(et.getHours(), et.getMinutes());
  const start = parseHHMM(regime.timeRange.start);
  const end = parseHHMM(regime.timeRange.end);
  const startMins = toMinutesOfDay(start.hours, start.minutes);
  const endMins = toMinutesOfDay(end.hours, end.minutes);

  // Handle overnight ranges (e.g. 20:00 - 00:00)
  if (endMins <= startMins) {
    return currentMins >= startMins || currentMins < endMins;
  }

  return currentMins >= startMins && currentMins < endMins;
}

export function getTimeRemaining(regime: TradingRegime, now?: Date): string {
  const et = now ?? getCurrentETTime();
  const currentMins = toMinutesOfDay(et.getHours(), et.getMinutes());
  const start = parseHHMM(regime.timeRange.start);
  const end = parseHHMM(regime.timeRange.end);
  const startMins = toMinutesOfDay(start.hours, start.minutes);
  const endMins = toMinutesOfDay(end.hours, end.minutes);

  if (isRegimeActive(regime, et)) {
    // Time until end
    let remaining: number;
    if (endMins <= startMins) {
      // Overnight: if we're past start, remaining = (1440 - currentMins) + endMins
      // if we're before end, remaining = endMins - currentMins
      remaining = currentMins >= startMins
        ? (1440 - currentMins) + endMins
        : endMins - currentMins;
    } else {
      remaining = endMins - currentMins;
    }
    return formatMinutes(remaining) + ' remaining';
  }

  // Time until start (today or next occurrence)
  const dayName = getETDayOfWeek(et);
  if (regime.daysActive.includes(dayName) && currentMins < startMins) {
    const until = startMins - currentMins;
    return 'starts in ' + formatMinutes(until);
  }

  // Next active day
  const dayOrder: TradingRegime['daysActive'][number][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const todayIdx = dayOrder.indexOf(dayName);
  for (let offset = 1; offset <= 7; offset++) {
    const checkDay = dayOrder[(todayIdx + offset) % 5];
    if (regime.daysActive.includes(checkDay)) {
      const daysAway = offset <= 5 - todayIdx ? offset : offset;
      if (daysAway === 1) return `tomorrow ${formatTime12H(regime.timeRange.start)} NY`;
      return `${checkDay} ${formatTime12H(regime.timeRange.start)} NY`;
    }
  }

  return formatTime12H(regime.timeRange.start) + ' NY';
}

function formatMinutes(mins: number): string {
  if (mins < 1) return '<1m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function getUpcomingRegimes(
  regimes: TradingRegime[],
  withinMinutes: number = 120,
  now?: Date,
): TradingRegime[] {
  const et = now ?? getCurrentETTime();
  const currentMins = toMinutesOfDay(et.getHours(), et.getMinutes());
  const dayName = getETDayOfWeek(et);

  return regimes.filter((r) => {
    if (isRegimeActive(r, et)) return false;
    if (!r.daysActive.includes(dayName)) return false;
    const startMins = toMinutesOfDay(...Object.values(parseHHMM(r.timeRange.start)) as [number, number]);
    const diff = startMins - currentMins;
    return diff > 0 && diff <= withinMinutes;
  });
}
