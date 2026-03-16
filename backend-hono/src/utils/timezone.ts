// [claude-code 2026-03-15] ET timezone utilities for scheduled tasks (P&L watchdog, health checks)

const ET_TZ = 'America/New_York';

/** Current date/time in Eastern Time */
export function getETDate(): Date {
  const str = new Date().toLocaleString('en-US', { timeZone: ET_TZ });
  return new Date(str);
}

/** Check if current ET time matches target hour:minute within tolerance (minutes) */
export function isETTimeMatch(hour: number, minute: number, tolerance = 1): boolean {
  const now = getETDate();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = hour * 60 + minute;
  return Math.abs(nowMinutes - targetMinutes) <= tolerance;
}

/** True if current ET day is Monday–Friday */
export function isWeekday(): boolean {
  const day = getETDate().getDay();
  return day >= 1 && day <= 5;
}

/** Format ET date as YYYY-MM-DD */
export function formatETDate(date?: Date): string {
  const d = date ?? getETDate();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
