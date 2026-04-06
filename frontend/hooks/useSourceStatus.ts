// [claude-code 2026-03-11] Source status hook — polls /api/riskflow/sources every 30s
import { useEffect, useState, useRef, useCallback } from 'react';

export interface SourceStatus {
  notion: boolean;
  twitterCli: boolean;
  twitterRateLimited: boolean;
  twitterCooldownSec: number;
  xApi: boolean;
  /** Whether the last poll to the backend succeeded */
  backendReachable: boolean;
  /** ISO timestamp of the last successful poll */
  lastPollSuccess: string;
}

const DEFAULT_STATUS: SourceStatus = { notion: false, twitterCli: false, twitterRateLimited: false, twitterCooldownSec: 0, xApi: false, backendReachable: false, lastPollSuccess: new Date(0).toISOString() };
const POLL_INTERVAL_MS = 30_000;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export function useSourceStatus(): SourceStatus {
  const [status, setStatus] = useState<SourceStatus>(DEFAULT_STATUS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(() => {
    fetch(`${API_BASE}/api/riskflow/sources`)
      .then((r) => r.json())
      .then((data: { notion: boolean; twitterCli: boolean; twitterRateLimited?: boolean; twitterCooldownSec?: number; xApi: boolean }) =>
        setStatus({
          ...data,
          twitterRateLimited: data.twitterRateLimited ?? false,
          twitterCooldownSec: data.twitterCooldownSec ?? 0,
          backendReachable: true,
          lastPollSuccess: new Date().toISOString(),
        }),
      )
      .catch(() => setStatus((prev) => ({ ...prev, backendReachable: false })));
  }, []);

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [poll]);

  return status;
}
