// [Codex 2026-05-27] S103 24h freshness window for manual Arbitrum runs.
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const MANUAL_RUN_WINDOW_MS = 24 * 60 * 60 * 1000;

interface ManualHistoryResponse {
  verdict?: { verdict_id?: string; id?: string; created_at?: string } | null;
  expires_at?: string;
  expired?: boolean;
}

export interface ArbitrumManualHistoryState {
  hasFreshRun: boolean;
  decayRatio: number;
  label: string;
  refresh: () => Promise<void>;
}

function formatHours(ms: number): string {
  const hours = Math.max(0, Math.ceil(ms / (60 * 60 * 1000)));
  return `${hours}h`;
}

export function useArbitrumManualHistory(): ArbitrumManualHistoryState {
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/arbitrum/latest?trigger=manual&max_age_hours=24`,
      );
      if (!res.ok) return;
      const body = (await res.json()) as ManualHistoryResponse;
      setCreatedAt(body.verdict?.created_at ?? null);
      setExpiresAt(body.expires_at ?? null);
      setExpired(Boolean(body.expired));
    } catch {
      /* non-blocking chrome status */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return useMemo(() => {
    if (!createdAt || expired) {
      return {
        hasFreshRun: false,
        decayRatio: 0,
        label: "No manual chamber read in the last 24h",
        refresh,
      };
    }
    const startMs = new Date(createdAt).getTime();
    const endMs = expiresAt
      ? new Date(expiresAt).getTime()
      : startMs + MANUAL_RUN_WINDOW_MS;
    const remainingMs = Math.max(0, endMs - now);
    const decayRatio = Math.max(
      0,
      Math.min(1, remainingMs / MANUAL_RUN_WINDOW_MS),
    );
    return {
      hasFreshRun: remainingMs > 0,
      decayRatio,
      label:
        remainingMs > 0
          ? `Manual chamber history: ${formatHours(remainingMs)} left`
          : "Manual chamber history expired",
      refresh,
    };
  }, [createdAt, expired, expiresAt, now, refresh]);
}
