// [claude-code 2026-04-26] S45-T2: usePlanFeedback — POST /api/day-plan/feedback.
//   Returns {submit, isSubmitting, lastError}. Used by the journal PlanFeedbackBlock.
import { useCallback, useState } from "react";
import type {
  PlanFeedbackPayload,
  PlanFeedbackResponse,
} from "../types/day-plan";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export function usePlanFeedback() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const submit = useCallback(
    async (
      payload: PlanFeedbackPayload,
    ): Promise<PlanFeedbackResponse | null> => {
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
        return (await res.json()) as PlanFeedbackResponse;
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
