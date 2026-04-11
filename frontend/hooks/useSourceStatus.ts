// [claude-code 2026-04-11] Renamed twitterCli → rettiwt, added pollingOwner + activePollers
import { useEffect, useState, useRef, useCallback } from "react";

export interface SourceStatus {
  notion: boolean;
  rettiwt: boolean;
  rettiwtRateLimited: boolean;
  rettiwtCooldownSec: number;
  pollingOwner: string | null;
  activePollers: string[];
  xApi: boolean;
  /** Whether the last poll to the backend succeeded */
  backendReachable: boolean;
  /** ISO timestamp of the last successful poll */
  lastPollSuccess: string;
}

const DEFAULT_STATUS: SourceStatus = {
  notion: false,
  rettiwt: false,
  rettiwtRateLimited: false,
  rettiwtCooldownSec: 0,
  pollingOwner: null,
  activePollers: [],
  xApi: false,
  backendReachable: false,
  lastPollSuccess: new Date(0).toISOString(),
};
const POLL_INTERVAL_MS = 30_000;
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export function useSourceStatus(): SourceStatus {
  const [status, setStatus] = useState<SourceStatus>(DEFAULT_STATUS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(() => {
    fetch(`${API_BASE}/api/riskflow/sources`)
      .then((r) => r.json())
      .then((data: Record<string, unknown>) => {
        const rettiwt = Boolean(data.rettiwt ?? false);
        const rateLimited = Boolean(data.rettiwtRateLimited ?? false);
        const cooldownSec = Number(data.rettiwtCooldownSec ?? 0);
        setStatus({
          notion: Boolean(data.notion),
          rettiwt,
          rettiwtRateLimited: rateLimited,
          rettiwtCooldownSec: cooldownSec,
          pollingOwner: (data.pollingOwner as string) ?? null,
          activePollers: (data.activePollers as string[]) ?? [],
          xApi: Boolean(data.xApi),
          backendReachable: true,
          lastPollSuccess: new Date().toISOString(),
        });
      })
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
