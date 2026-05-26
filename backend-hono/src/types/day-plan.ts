// [claude-code 2026-05-15] S66-T1: added planVariant field for multi-plan-per-day support
// [claude-code 2026-05-15] Econ forecast: replaced price fields (invalidation/profitTarget/entries/
//   pricesOfInterest/expectedMovePct) with econForecast containing miss/beat scenarios,
//   AI prediction, and other notable events. Prices now pulled fresh at viewing time.

export type DriftKind = "drift_alert" | "tilt_stop" | "dead_volume";

export type DailyColor = "green" | "red" | "flat";

export type FeedbackAction = "followed" | "faded" | "sat_out";

export type PositioningBias =
  | "bullish"
  | "tactically_bullish"
  | "bearish"
  | "tactically_bearish";

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
  startTime: string;
  endTime: string;
  /** Enriched economic event name for this window */
  eventName?: string | null;
  /** Country/region abbreviation for the matched overnight or international event */
  eventCountry?: string | null;
  /** Optional event importance imported from calendar/ICS sources. */
  importance?: string | number | null;
  impact?: string | number | null;
  severity?: string | number | null;
  /** AI-generated econ forecast (miss/beat scenarios + prediction) */
  econForecast: EconForecast | null;
  /** Deprecated — retained for schema compatibility during migration transition */
  pricesOfInterest?: number[];
  entries?: number[];
  invalidation?: number | null;
  profitTarget?: number | null;
  expectedMovePct?: number | null;
  sessionPrice?: number | null;
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
  planVariant?: string | null;
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
