// [claude-code 2026-04-26] S45-T2: Day-plan types (mobile copy) — mirrors
//   backend-hono/src/types/day-plan.ts verbatim. Mobile keeps its own inline
//   copy because the mobile bundle does not import from frontend/ (separate
//   vite build, separate token system).

export type DriftKind = "drift_alert" | "tilt_stop" | "dead_volume";

export type DailyColor = "green" | "red" | "flat";

export type FeedbackAction = "followed" | "faded" | "sat_out";

export interface DayPlanWindow {
  id: string;
  dayPlanId: string;
  windowIndex: number;
  startTime: string;
  endTime: string;
  pricesOfInterest: number[];
  invalidation: number | null;
  profitTarget: number | null;
  expectedMovePct: number | null;
}

export interface DayPlan {
  id: string;
  teamId: string;
  date: string;
  eventName: string | null;
  deskTheme: string | null;
  generatedBy: string;
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
  createdAt: string;
}

export interface DayPlanStreak {
  id: string;
  userId: string;
  date: string;
  dailyPnl: number;
  dailyColor: DailyColor;
  streakAtClose: number;
  createdAt: string;
}

export interface DriftStatus {
  inWindow: boolean;
  kind: DriftKind | null;
  firedAt: string | null;
  message: string | null;
}

export interface WeekDayEntry {
  date: string;
  day: string;
  ivScore: number | null;
  windowCount: number;
  eventName: string | null;
}

export interface StreakResponse {
  streakAtClose: number;
  last30: Array<{ date: string; color: DailyColor }>;
}
