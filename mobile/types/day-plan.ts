// [claude-code 2026-04-26] S45-T2: Day-plan types (mobile copy) — mirrors
//   frontend/types/day-plan.ts and backend-hono/src/types/day-plan.ts.
//   Mobile keeps its own inline copy because the mobile bundle does not import
//   from frontend/ (separate vite build, separate token system).

export type DriftState =
  | "in-window"
  | "drift-alert"
  | "tilt-stop"
  | "dead-volume";

export type PlanFeedbackAction = "followed" | "faded" | "sat-out";

export type PlanFeedbackReasonCode =
  | "better-setup-elsewhere"
  | "plan-felt-wrong"
  | "news-override"
  | "tilt"
  | "fomo"
  | "risk-off"
  | "other";

export interface DayPlanWindow {
  window_id: string;
  event: string | null;
  trading_window: string;
  prices_of_interest: number[];
  invalidation_point: number;
  profit_target: number;
  expected_move: string;
}

export interface DayPlan {
  date: string;
  desk_theme: string;
  windows: DayPlanWindow[];
  brief_source?: string;
  published_at?: string;
}

export interface DayPlanWeekDay {
  date: string;
  day_label: string;
  iv_score: number | null;
  windows_count: number;
  event_label: string;
}

export interface DayPlanWeekResponse {
  days: DayPlanWeekDay[];
}

export interface DriftStatusResponse {
  state: DriftState;
  message: string;
  computed_at: string;
}

export interface StreakResponse {
  current: number;
  last_milestone: number | null;
  last_green_day: string | null;
}

export interface PlanFeedbackPayload {
  window_id: string;
  action: PlanFeedbackAction;
  reason_code?: PlanFeedbackReasonCode | null;
  reason_text?: string | null;
}

export interface PlanFeedbackResponse {
  ok: boolean;
  feedback: PlanFeedbackPayload & { id: string; submitted_at: string };
}
