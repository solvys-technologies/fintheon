// [claude-code 2026-04-10] S9-T1: Shared time utilities — extracted from 7 files
import { formatEasternTime } from "./eastern-time-format";

/** Human-readable relative time from ISO string ("just now", "5m ago", "2h ago", "3d ago") */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Format Date to locale time string */
export function formatTimestamp(date: Date): string {
  return formatEasternTime(date);
}
