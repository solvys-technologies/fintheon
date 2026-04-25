// [claude-code 2026-04-25] S35: mobile Arbitrum hook — fetches /api/arbitrum/latest with
// 60s polling. Mirrors the desktop hook so the verdict shape is identical across surfaces.
import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";
const POLL_MS = 60_000;

export interface ArbitrumSeat {
  role: "Lead" | "Forecaster" | "Risk" | "Quant" | "Bear";
  model: string;
  probability: number;
  confidence: number;
  rationale: string;
  dissented?: boolean;
}

export interface ArbitrumVerdict {
  id: string;
  verdict_id?: string;
  consensus_probability: number;
  confidence: number;
  digest_text: string;
  dissent?: { count: number; summary?: string } | null;
  seats?: ArbitrumSeat[];
  iv_simulation?: { regime_shift_probability?: number } | null;
  upcoming_catalysts?: Array<{ name: string; date: string; impact?: string }>;
  trigger_type?: "event" | "session" | "manual";
  created_at: string;
  rounds_total?: number;
  rounds_complete?: number;
  phase?: "convening" | "deliberating" | "synthesizing" | "complete";
}

interface ArbitrumLatestState {
  verdict: ArbitrumVerdict | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useArbitrumLatest(): ArbitrumLatestState {
  const [verdict, setVerdict] = useState<ArbitrumVerdict | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/arbitrum/latest`);
      if (!mountedRef.current) return;
      if (res.status === 404 || res.status === 204) {
        setVerdict(null);
        setError(null);
        return;
      }
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as
        | ArbitrumVerdict
        | { verdict: ArbitrumVerdict | null }
        | null;
      if (!mountedRef.current) return;
      const next =
        body && typeof body === "object" && "verdict" in body
          ? (body.verdict ?? null)
          : ((body as ArbitrumVerdict | null) ?? null);
      setVerdict(next);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "fetch failed");
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchLatest();
    const id = setInterval(() => void fetchLatest(), POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchLatest]);

  return { verdict, isLoading, error, refresh: fetchLatest };
}
