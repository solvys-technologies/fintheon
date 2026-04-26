// [claude-code 2026-04-26] S45-T2: Day-plan types — mirrors backend-hono/src/types/day-plan.ts
//   from T1 (orchestrator validates parity at unification). Names + unions held identical.
//   Drift states from S45 brief: in-window / drift-alert / tilt-stop / dead-volume.
//   Plan feedback action triad: followed / faded / sat-out.

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
  /** Stable id assigned by backend — used as key + for feedback POST. */
  window_id: string;
  /** Event name (e.g. "FOMC rate decision") or "—" / null when no catalyst. */
  event: string | null;
  /** "HH:MM-HH:MM" 24h, e.g. "09:30-10:15". */
  trading_window: string;
  /** Up to 2 entry prices. */
  prices_of_interest: number[];
  invalidation_point: number;
  profit_target: number;
  /** "± 0.84%" — pre-formatted by backend. */
  expected_move: string;
}

export interface DayPlan {
  /** ISO date YYYY-MM-DD. */
  date: string;
  /** 1-line message tying the idea to the day's brief catalyst. */
  desk_theme: string;
  /** One window per trading idea — usually 1, occasionally 2. */
  windows: DayPlanWindow[];
  /** Source brief (MDB / ADB / PMDB / TWT) the plan was anchored to. */
  brief_source?: string;
  /** ISO timestamp the plan was published. */
  published_at?: string;
}

/** Mon–Fri preview pill for the Strategium bulletin tab + mobile parity. */
export interface DayPlanWeekDay {
  /** YYYY-MM-DD. */
  date: string;
  /** "Mon" | "Tue" | … */
  day_label: string;
  /** IV score 0–10 for the day, or null when no plan. */
  iv_score: number | null;
  /** Number of trading windows in the day's plan. */
  windows_count: number;
  /** Truncated event name; falls back to "—". */
  event_label: string;
}

export interface DayPlanWeekResponse {
  days: DayPlanWeekDay[];
}

export interface DriftStatusResponse {
  state: DriftState;
  /** Harper-voiced message text (rendered in tooltip). */
  message: string;
  /** ISO timestamp the status was computed. */
  computed_at: string;
}

export interface StreakResponse {
  /** Current green-day streak count. */
  current: number;
  /** Most recent milestone crossed (5/10/21/50) — used to fire pulse. */
  last_milestone: number | null;
  /** ISO date of the last green day. */
  last_green_day: string | null;
}

export interface PlanFeedbackPayload {
  window_id: string;
  action: PlanFeedbackAction;
  reason_code?: PlanFeedbackReasonCode | null;
  /** Free-text "why" — only when action=faded and reason_code is tilt/fomo. */
  reason_text?: string | null;
}

export interface PlanFeedbackResponse {
  ok: boolean;
  /** The submitted feedback row, echoed back. */
  feedback: PlanFeedbackPayload & { id: string; submitted_at: string };
}
