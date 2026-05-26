// [claude-code 2026-05-15] Econ forecast: replaced price fields with econForecast.
//   Mirrors backend-hono/src/types/day-plan.ts verbatim.

export type DriftKind = "drift_alert" | "tilt_stop" | "dead_volume";

export type DailyColor = "green" | "red" | "flat";

export type FeedbackAction = "followed" | "faded" | "sat_out";

export interface EconForecastScenario {
  description: string;
  isBullishForEquities: boolean;
  probability: number;
  agenticPrint?: string;
}

export interface EconForecast {
  forecast: string;
  miss: EconForecastScenario;
  beat: EconForecastScenario;
  otherNotableEvents: string[];
  aiPrediction: string;
  generatedAt: string;
  eventCountry?: string | null;
  eventTime?: string | null;
  validationChecks?: EconForecastValidationCheck[];
}

export interface EconForecastValidationCheck {
  pass: number;
  verdict: "pass" | "adjusted" | "fallback_pass";
  rationale: string;
  checkedAt: string;
}

export interface DayPlanWindow {
  id: string;
  dayPlanId: string;
  windowIndex: number;
  /** "HH:MM" America/New_York */
  startTime: string;
  /** "HH:MM" America/New_York */
  endTime: string;
  eventName?: string | null;
  eventCountry?: string | null;
  importance?: string | number | null;
  impact?: string | number | null;
  severity?: string | number | null;
  econForecast: EconForecast | null;
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
