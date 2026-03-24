// [claude-code 2026-03-06] NarrativeFlow time utilities — pure functions, no React deps
import type { ZoomLevel } from './narrative-types';

export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export function shiftWeek(monday: Date, offset: number): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + offset * 7);
  return d;
}

export function getMonthWeeks(year: number, month: number): Date[] {
  const weeks: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let monday = getMonday(firstDay);
  while (monday <= lastDay) {
    weeks.push(new Date(monday));
    monday = new Date(monday);
    monday.setDate(monday.getDate() + 7);
  }
  return weeks;
}

export function getQuarterMonths(year: number, quarter: 1 | 2 | 3 | 4): { year: number; month: number }[] {
  const startMonth = (quarter - 1) * 3;
  return [
    { year, month: startMonth },
    { year, month: startMonth + 1 },
    { year, month: startMonth + 2 },
  ];
}

export function getYearQuarters(_year: number): (1 | 2 | 3 | 4)[] {
  return [1, 2, 3, 4];
}

export function formatWeekLabel(monday: Date): string {
  const fri = new Date(monday);
  fri.setDate(monday.getDate() + 4);
  const mo = monday.toLocaleDateString('en-US', { month: 'short' });
  const friMo = fri.toLocaleDateString('en-US', { month: 'short' });
  if (mo === friMo) {
    return `${mo} ${monday.getDate()} \u2013 ${fri.getDate()}, ${monday.getFullYear()}`;
  }
  return `${mo} ${monday.getDate()} \u2013 ${friMo} ${fri.getDate()}, ${monday.getFullYear()}`;
}

export function formatDayLabel(date: Date): string {
  const day = date.toLocaleDateString('en-US', { weekday: 'short' });
  return `${day} ${date.getMonth() + 1}/${date.getDate()}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function isSameWeek(a: Date, b: Date): boolean {
  return isSameDay(getMonday(a), getMonday(b));
}

export function weeksAgo(from: Date, to?: Date): number {
  const target = to ?? new Date();
  const diffMs = target.getTime() - from.getTime();
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
}

export function getDateRangeForZoom(zoomLevel: ZoomLevel, anchor: Date): { start: Date; end: Date } {
  const monday = getMonday(anchor);
  switch (zoomLevel) {
    case 'week':
      return { start: monday, end: new Date(monday.getTime() + 4 * 24 * 60 * 60 * 1000) };
    case 'month': {
      const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      return { start, end };
    }
    case 'quarter': {
      const q = Math.floor(anchor.getMonth() / 3);
      const start = new Date(anchor.getFullYear(), q * 3, 1);
      const end = new Date(anchor.getFullYear(), q * 3 + 3, 0);
      return { start, end };
    }
    case 'year': {
      const start = new Date(anchor.getFullYear(), 0, 1);
      const end = new Date(anchor.getFullYear(), 11, 31);
      return { start, end };
    }
  }
}
