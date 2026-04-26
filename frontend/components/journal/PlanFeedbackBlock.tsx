// [claude-code 2026-04-26] S45-T2: PlanFeedbackBlock — one row per window in
//   today's day plan. 3-segment triad: Followed / Faded / Sat-out. When Faded
//   selected, right-stacked chevron expands a reason-chip row. Free-text "why"
//   only when Tilt or FOMO selected. Submit = circular ArrowUp (memory pin:
//   never paper-airplane). Field names mirror T1 backend FeedbackAction
//   ("followed" | "faded" | "sat_out") + DayPlanWindow shape (id, startTime,
//   endTime).
import { useState } from "react";
import { ArrowUp, ChevronRight } from "lucide-react";
import { usePlanFeedback } from "../../hooks/usePlanFeedback";
import type { DayPlanWindow, FeedbackAction } from "../../types/day-plan";

const ACTIONS: { id: FeedbackAction; label: string }[] = [
  { id: "followed", label: "Followed" },
  { id: "faded", label: "Faded" },
  { id: "sat_out", label: "Sat-out" },
];

type ReasonCode =
  | "better_setup_elsewhere"
  | "plan_felt_wrong"
  | "news_override"
  | "tilt"
  | "fomo"
  | "risk_off"
  | "other";

const REASON_CHIPS: { id: ReasonCode; label: string }[] = [
  { id: "better_setup_elsewhere", label: "Better setup elsewhere" },
  { id: "plan_felt_wrong", label: "Plan felt wrong" },
  { id: "news_override", label: "News override" },
  { id: "tilt", label: "Tilt" },
  { id: "fomo", label: "FOMO" },
  { id: "risk_off", label: "Risk-off" },
  { id: "other", label: "Other" },
];

const NEEDS_REASON_TEXT: ReadonlySet<ReasonCode> = new Set(["tilt", "fomo"]);

interface PlanFeedbackBlockProps {
  window: DayPlanWindow;
}

export function PlanFeedbackBlock({ window }: PlanFeedbackBlockProps) {
  const [action, setAction] = useState<FeedbackAction | null>(null);
  const [reasonCode, setReasonCode] = useState<ReasonCode | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { submit, isSubmitting } = usePlanFeedback();

  const showFadedReasons = action === "faded";
  const showFreeText =
    action === "faded" &&
    reasonCode != null &&
    NEEDS_REASON_TEXT.has(reasonCode);

  const canSubmit =
    !!action &&
    !isSubmitting &&
    !submitted &&
    (action !== "faded" || !!reasonCode);

  const tradingWindow = `${window.startTime}-${window.endTime}`;

  const onSubmit = async () => {
    if (!canSubmit || !action) return;
    const res = await submit({
      windowId: window.id,
      action,
      reasonCode: action === "faded" ? reasonCode : null,
      reasonText:
        action === "faded" && reasonCode && NEEDS_REASON_TEXT.has(reasonCode)
          ? reasonText.trim() || null
          : null,
    });
    if (res) setSubmitted(true);
  };

  return (
    <div
      className="space-y-2"
      data-window-id={window.id}
      aria-label={`Plan feedback for ${tradingWindow}`}
    >
      <div className="flex items-baseline justify-between">
        <span
          className="text-[10px] uppercase tracking-[0.16em]"
          style={{
            color: "var(--fintheon-muted)",
            fontFamily: "var(--font-data, monospace)",
          }}
        >
          {tradingWindow}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="flex flex-1 rounded-md overflow-hidden"
          role="radiogroup"
          aria-label="Plan adherence"
        >
          {ACTIONS.map((a, i) => {
            const active = action === a.id;
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={submitted}
                onClick={() => {
                  setAction(a.id);
                  if (a.id !== "faded") {
                    setReasonCode(null);
                    setReasonText("");
                  }
                }}
                className="flex-1 py-1.5 text-[10px] uppercase tracking-wide transition-colors disabled:opacity-50"
                style={{
                  color: active
                    ? "var(--fintheon-accent)"
                    : "var(--fintheon-muted)",
                  background: active
                    ? "color-mix(in srgb, var(--fintheon-accent) 14%, transparent)"
                    : "color-mix(in srgb, var(--fintheon-bg) 50%, transparent)",
                  borderRight:
                    i < ACTIONS.length - 1
                      ? "1px solid color-mix(in srgb, var(--fintheon-accent) 12%, transparent)"
                      : "none",
                }}
              >
                {a.label}
              </button>
            );
          })}
        </div>

        {showFadedReasons && (
          <ChevronRight
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: "var(--fintheon-accent)" }}
            aria-hidden
          />
        )}
      </div>

      {showFadedReasons && (
        <div className="flex flex-wrap gap-1.5 animate-in fade-in duration-150">
          {REASON_CHIPS.map((c) => {
            const on = reasonCode === c.id;
            return (
              <button
                key={c.id}
                type="button"
                disabled={submitted}
                onClick={() => setReasonCode(c.id)}
                className="text-[10px] px-2 py-1 rounded-full transition-colors disabled:opacity-50"
                style={{
                  color: on
                    ? "var(--fintheon-accent)"
                    : "var(--fintheon-muted)",
                  background: on
                    ? "color-mix(in srgb, var(--fintheon-accent) 14%, transparent)"
                    : "color-mix(in srgb, var(--fintheon-bg) 60%, transparent)",
                  border: `1px solid color-mix(in srgb, var(--fintheon-accent) ${on ? 35 : 12}%, transparent)`,
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {showFreeText && (
        <input
          type="text"
          value={reasonText}
          disabled={submitted}
          onChange={(e) => setReasonText(e.target.value)}
          placeholder="Why? (optional)"
          maxLength={200}
          className="w-full bg-transparent rounded-md px-2.5 py-1.5 text-[11px] outline-none placeholder:text-gray-600 transition-colors"
          style={{
            border:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 18%, transparent)",
            color: "var(--fintheon-text)",
            fontFamily: "var(--font-body)",
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <span className="text-[9px]" style={{ color: "var(--fintheon-muted)" }}>
          {submitted
            ? "Logged"
            : action === "faded" && !reasonCode
              ? "Pick a reason"
              : action
                ? "Ready"
                : "Choose Followed / Faded / Sat-out"}
        </span>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          aria-label="Submit plan feedback"
          title="Submit"
          className="w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-40"
          style={{
            background: canSubmit
              ? "color-mix(in srgb, var(--fintheon-accent) 18%, transparent)"
              : "color-mix(in srgb, var(--fintheon-accent) 8%, transparent)",
            color: "var(--fintheon-accent)",
            border:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 30%, transparent)",
          }}
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
