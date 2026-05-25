import { useEffect, useRef } from "react";
import { useToast } from "../contexts/ToastContext";
import { AI_CREDITS_EXHAUSTED } from "../lib/aiCreditErrors";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const DEDUP_MS = 120_000;
const TOAST_MS = 12_000;

interface HealthResponse {
  components?: {
    aiGateway?: {
      status?: string;
      details?: {
        code?: string;
        provider?: string;
        message?: string;
        fix?: string;
      };
    };
  };
}

export function AiCreditToastBridge() {
  const { addToast } = useToast();
  const lastShownAt = useRef(0);

  useEffect(() => {
    function show(source?: string) {
      const now = Date.now();
      if (now - lastShownAt.current < DEDUP_MS) return;
      lastShownAt.current = now;
      const suffix = source ? ` (${source})` : "";
      addToast(
        `Hermes credits exhausted${suffix}`,
        "error",
        "Top up credits or replace the API key in Settings > API.",
        "api-error",
        "bottom-left",
        undefined,
        undefined,
        TOAST_MS,
      );
    }

    let cancelled = false;
    async function checkHealth() {
      try {
        const res = await fetch(`${API_BASE}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        const body = (await res.json()) as HealthResponse;
        const details = body.components?.aiGateway?.details;
        if (details?.code === AI_CREDITS_EXHAUSTED) {
          show(details.provider);
        }
      } catch {
        // GatewayContext owns backend connectivity toasts.
      }
      if (!cancelled) window.setTimeout(checkHealth, 30_000);
    }

    void checkHealth();
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  return null;
}
