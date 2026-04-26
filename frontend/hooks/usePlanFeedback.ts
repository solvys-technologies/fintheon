// [claude-code 2026-04-26] S45-T2: usePlanFeedback — POST /api/day-plan/feedback.
//   Returns {submit, isSubmitting, lastError}. Used by the journal PlanFeedbackBlock.
//   Payload mirrors the server's DayPlanFeedback insert shape: windowId + action +
//   reasonCode + reasonText. Server returns the persisted DayPlanFeedback row.
import { useCallback, useState } from "react";
import type { DayPlanFeedback, FeedbackAction } from "../types/day-plan";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface PlanFeedbackPayload {
  windowId: string;
  action: FeedbackAction;
  reasonCode?: string | null;
  /** Free-text "why" — optional. */
  reasonText?: string | null;
}

export function usePlanFeedback() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const submit = useCallback(
    async (payload: PlanFeedbackPayload): Promise<DayPlanFeedback | null> => {
      setIsSubmitting(true);
      setLastError(null);
      try {
        const res = await fetch(`${API_BASE}/api/day-plan/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          setLastError(`HTTP ${res.status}`);
          return null;
        }
        return (await res.json()) as DayPlanFeedback;
      } catch (err) {
        setLastError(err instanceof Error ? err.message : "submit failed");
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  return { submit, isSubmitting, lastError };
}
