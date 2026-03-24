// [claude-code 2026-03-11] Source status hook — polls /api/riskflow/sources every 30s
import { useEffect, useState, useRef, useCallback } from 'react';

export interface SourceStatus {
  notion: boolean;
  twitterCli: boolean;
  xApi: boolean;
}

const DEFAULT_STATUS: SourceStatus = { notion: false, twitterCli: false, xApi: false };
const POLL_INTERVAL_MS = 30_000;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export function useSourceStatus(): SourceStatus {
  const [status, setStatus] = useState<SourceStatus>(DEFAULT_STATUS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(() => {
    fetch(`${API_BASE}/api/riskflow/sources`)
      .then((r) => r.json())
      .then((data: SourceStatus) => setStatus(data))
      .catch(() => {});
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
