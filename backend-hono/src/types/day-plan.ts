// [claude-code 2026-05-06] S59-T4: added entries[] (80/20 handles) + institutionalPositioning field.

export type DriftKind = "drift_alert" | "tilt_stop" | "dead_volume";

export type DailyColor = "green" | "red" | "flat";

export type FeedbackAction = "followed" | "faded" | "sat_out";

export type PositioningBias =
  | "bullish"
  | "tactically_bullish"
  | "bearish"
  | "tactically_bearish";

export interface DayPlanWindow {
  id: string;
  dayPlanId: string;
  windowIndex: number;
  startTime: string;
  endTime: string;
  pricesOfInterest: number[];
  entries: number[];
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
  institutionalPositioning: PositioningBias | null;
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
