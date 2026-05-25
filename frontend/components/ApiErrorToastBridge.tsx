// [claude-code 2026-03-16] Bridges apiClient error bus → Toast notifications
import { useEffect, useRef } from "react";
import { useToast } from "../contexts/ToastContext";
import {
  onApiError,
  getFixDescription,
  type ApiErrorEvent,
} from "../lib/errorBus";
import { AI_CREDITS_EXHAUSTED } from "../lib/aiCreditErrors";

/** Minimum ms between toasts for the same error code to prevent spam */
const DEDUP_WINDOW_MS = 5000;

export function ApiErrorToastBridge() {
  const { addToast } = useToast();
  const recent = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    return onApiError((err: ApiErrorEvent) => {
      // Deduplicate: skip if we showed the same code within the window
      const key = err.code + (err.endpoint ?? "");
      const now = Date.now();
      const last = recent.current.get(key);
      if (last && now - last < DEDUP_WINDOW_MS) return;
      recent.current.set(key, now);

      // Clean old entries periodically
      if (recent.current.size > 50) {
        for (const [k, t] of recent.current) {
          if (now - t > DEDUP_WINDOW_MS) recent.current.delete(k);
        }
      }

      const fix = getFixDescription(err.code, err.status);
      if (err.code === AI_CREDITS_EXHAUSTED) {
        addToast(
          "Hermes credits exhausted",
          "error",
          fix,
          "api-error",
          "bottom-left",
          undefined,
          undefined,
          12000,
        );
        return;
      }
      const label = err.endpoint
        ? `${err.message} (${err.endpoint.replace("/api/", "")})`
        : err.message;

      addToast(label, "error", fix, "api-error");
    });
  }, [addToast]);

  return null;
}
