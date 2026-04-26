// [claude-code 2026-04-26] S45-T1: dead-volume rule. 45 minutes after the
// final trading window closes the desk is in a no-edge zone — fills there get
// flagged as "dead volume" rather than drift.

const DEAD_VOLUME_LAG_MIN = 45;

export interface DayPlanWindowLite {
  startTime: string; // "HH:MM" America/New_York
  endTime: string; // "HH:MM" America/New_York
}

export function isDeadVolume(
  fillEt: Date,
  windows: DayPlanWindowLite[],
): boolean {
  if (windows.length === 0) return false;
  const lastEnd = lastWindowEndMinutes(windows);
  if (lastEnd == null) return false;
  const fillMinutes = fillEt.getHours() * 60 + fillEt.getMinutes();
  return fillMinutes >= lastEnd + DEAD_VOLUME_LAG_MIN;
}

export function isInsideAnyWindow(
  fillEt: Date,
  windows: DayPlanWindowLite[],
): boolean {
  const fillMinutes = fillEt.getHours() * 60 + fillEt.getMinutes();
  for (const w of windows) {
    const start = hhmmToMinutes(w.startTime);
    const end = hhmmToMinutes(w.endTime);
    if (start == null || end == null) continue;
    if (fillMinutes >= start && fillMinutes <= end) return true;
  }
  return false;
}

function lastWindowEndMinutes(windows: DayPlanWindowLite[]): number | null {
  let last = -Infinity;
  for (const w of windows) {
    const end = hhmmToMinutes(w.endTime);
    if (end != null && end > last) last = end;
  }
  return Number.isFinite(last) ? last : null;
}

function hhmmToMinutes(hhmm: string): number | null {
  const match = hhmm.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}
