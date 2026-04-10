// [claude-code 2026-02-26] Boardroom meeting schedule derived from cron configuration.

import { CronExpressionParser } from "cron-parser";

export type BoardroomMeetingSchedule = {
  nowIso: string;
  lastMeetingIso: string;
  nextMeetingIso: string;
  meetingWindowMinutes: number;
  live: boolean;
  source: "cron" | "fallback";
};

function computeFallback(now: Date): BoardroomMeetingSchedule {
  const hourRaw = process.env.BOARDROOM_MEETING_HOUR_LOCAL;
  const hour = Number.isFinite(Number(hourRaw)) ? Number(hourRaw) : 9;
  const meetingWindowMinutesRaw = process.env.BOARDROOM_MEETING_WINDOW_MINUTES;
  const meetingWindowMinutes = Number.isFinite(Number(meetingWindowMinutesRaw))
    ? Number(meetingWindowMinutesRaw)
    : 90;

  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setHours(hour, 0, 0, 0);

  const last =
    candidate.getTime() <= now.getTime()
      ? candidate
      : new Date(candidate.getTime() - 24 * 60 * 60 * 1000);
  const next =
    candidate.getTime() > now.getTime()
      ? candidate
      : new Date(candidate.getTime() + 24 * 60 * 60 * 1000);

  const live =
    now.getTime() >= last.getTime() &&
    now.getTime() < last.getTime() + meetingWindowMinutes * 60 * 1000;

  return {
    nowIso: now.toISOString(),
    lastMeetingIso: last.toISOString(),
    nextMeetingIso: next.toISOString(),
    meetingWindowMinutes,
    live,
    source: "fallback",
  };
}

export function getBoardroomMeetingSchedule(
  now = new Date(),
): BoardroomMeetingSchedule {
  const cron = process.env.HERMES_BOARDROOM_CRON?.trim();
  const tz = process.env.HERMES_BOARDROOM_TZ?.trim();
  const meetingWindowMinutesRaw = process.env.BOARDROOM_MEETING_WINDOW_MINUTES;
  const meetingWindowMinutes = Number.isFinite(Number(meetingWindowMinutesRaw))
    ? Number(meetingWindowMinutesRaw)
    : 90;

  if (!cron) return computeFallback(now);

  try {
    const options = {
      currentDate: now,
      tz: tz || undefined,
    };

    // cron-parser v5: default export is CronExpressionParser with static parse()
    const interval = CronExpressionParser.parse(cron, options);
    const next = interval.next().toDate();

    const intervalPrev = CronExpressionParser.parse(cron, options);
    const last = intervalPrev.prev().toDate();

    const live =
      now.getTime() >= last.getTime() &&
      now.getTime() < last.getTime() + meetingWindowMinutes * 60 * 1000;

    return {
      nowIso: now.toISOString(),
      lastMeetingIso: last.toISOString(),
      nextMeetingIso: next.toISOString(),
      meetingWindowMinutes,
      live,
      source: "cron",
    };
  } catch (error) {
    console.error(
      "[BoardroomSchedule] Failed to parse cron, using fallback:",
      error,
    );
    return computeFallback(now);
  }
}
