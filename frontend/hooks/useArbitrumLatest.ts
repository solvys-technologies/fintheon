// [claude-code 2026-04-24] S35-T3: fetch /api/arbitrum/latest with 60s poll
import { useCallback, useEffect, useRef, useState } from "react";
import type { ArbitrumVerdict } from "../components/arbitrum/types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const POLL_MS = 60_000;

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
      const res = await fetch(`${API_BASE}/api/arbitrum/latest`, {
        credentials: "include",
      });
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
    const id = setInterval(() => {
      void fetchLatest();
    }, POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchLatest]);

  return { verdict, isLoading, error, refresh: fetchLatest };
}
