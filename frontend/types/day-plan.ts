// [claude-code 2026-04-26] S45-T2: Day-plan types — mirrors
//   backend-hono/src/types/day-plan.ts verbatim. Orchestrator validates parity
//   at unification, so field names + unions stay byte-identical.

export type DriftKind = "drift_alert" | "tilt_stop" | "dead_volume";

export type DailyColor = "green" | "red" | "flat";

export type FeedbackAction = "followed" | "faded" | "sat_out";

export interface DayPlanWindow {
  id: string;
  dayPlanId: string;
  windowIndex: number;
  /** "HH:MM" America/New_York */
  startTime: string;
  /** "HH:MM" America/New_York */
  endTime: string;
  pricesOfInterest: number[];
  invalidation: number | null;
  profitTarget: number | null;
  expectedMovePct: number | null;
}

export interface DayPlan {
  id: string;
  teamId: string;
  /** ISO date "YYYY-MM-DD" */
  date: string;
  eventName: string | null;
  deskTheme: string | null;
  generatedBy: string;
  /** ISO timestamp */
  generatedAt: string;
  sourceBriefId: string | null;
  windows: DayPlanWindow[];
}

export interface DayPlanFeedback {
  id: string;
  windowId: string;
  userId: string | null;
  action: FeedbackAction;
  reasonCode: string | null;
  reasonText: string | null;
  fillPrice: number | null;
  outcomePnl: number | null;
  /** ISO timestamp */
  createdAt: string;
}

export interface DayPlanStreak {
  id: string;
  userId: string;
  /** ISO date "YYYY-MM-DD" */
  date: string;
  dailyPnl: number;
  dailyColor: DailyColor;
  streakAtClose: number;
  /** ISO timestamp */
  createdAt: string;
}

export interface DriftStatus {
  inWindow: boolean;
  kind: DriftKind | null;
  /** ISO timestamp; null when no drift event recorded */
  firedAt: string | null;
  message: string | null;
}

export interface WeekDayEntry {
  /** ISO date "YYYY-MM-DD" */
  date: string;
  /** Day-of-week label, e.g. "Mon" */
  day: string;
  ivScore: number | null;
  windowCount: number;
  eventName: string | null;
}

export interface StreakResponse {
  streakAtClose: number;
  last30: Array<{ date: string; color: DailyColor }>;
}
