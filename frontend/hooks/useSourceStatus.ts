// [claude-code 2026-04-11] Renamed twitterCli → rettiwt, added pollingOwner + activePollers
// [claude-code 2026-04-17] Cache last-known-good status to localStorage so self team card
//                          hydrates with accurate data on app reopen instead of flashing red
// [claude-code 2026-04-18] S25-T4: consume multi-source health + per-user polling timestamps
import { useEffect, useState, useRef, useCallback } from "react";

export interface RettiwtPoolStatus {
  totalKeys: number;
  availableKeys: number;
  cooldownKeys: number;
  disabledKeys: number;
}

export interface SourceDetail {
  active: boolean;
  lastRunAt: string | null;
}

export interface AgentReachDetail extends SourceDetail {
  domains: Record<string, "ok" | "tripped" | "cooldown">;
}

export interface UserPollStat {
  lastPollAt: string | null;
  lastSuccessAt: string | null;
  totalContributions: number;
  currentlyOwner: boolean;
}

export interface SourceStatus {
  supabase: boolean;
  rettiwt: boolean;
  rettiwtRateLimited: boolean;
  rettiwtCooldownSec: number;
  rettiwtPool: RettiwtPoolStatus | null;
  pollingOwner: string | null;
  activePollers: string[];
  xApi: boolean;
  /** Whether the last poll to the backend succeeded */
  backendReachable: boolean;
  /** ISO timestamp of the last successful poll */
  lastPollSuccess: string;

  // S25-T4 additions
  newsfeedHealthy: boolean;
  newsfeedDegraded: boolean;
  agentReach: AgentReachDetail;
  feedPoller: SourceDetail;
  userPollStats: Record<string, UserPollStat>;
}

const DEFAULT_STATUS: SourceStatus = {
  supabase: false,
  rettiwt: false,
  rettiwtRateLimited: false,
  rettiwtCooldownSec: 0,
  rettiwtPool: null,
  pollingOwner: null,
  activePollers: [],
  xApi: false,
  backendReachable: false,
  lastPollSuccess: new Date(0).toISOString(),
  newsfeedHealthy: false,
  newsfeedDegraded: false,
  agentReach: { active: false, lastRunAt: null, domains: {} },
  feedPoller: { active: false, lastRunAt: null },
  userPollStats: {},
};
const POLL_INTERVAL_MS = 30_000;
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const CACHE_KEY = "fintheon:sourceStatus";
const CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function loadCachedStatus(): SourceStatus {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return DEFAULT_STATUS;
    const cached = JSON.parse(raw) as SourceStatus;
    const lastPollMs = new Date(cached.lastPollSuccess).getTime();
    if (!Number.isFinite(lastPollMs)) return DEFAULT_STATUS;
    if (Date.now() - lastPollMs > CACHE_MAX_AGE_MS) return DEFAULT_STATUS;
    return cached;
  } catch {
    return DEFAULT_STATUS;
  }
}

export function useSourceStatus(): SourceStatus {
  const [status, setStatus] = useState<SourceStatus>(loadCachedStatus);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(() => {
    fetch(`${API_BASE}/api/riskflow/sources`)
      .then((r) => r.json())
      .then((data: Record<string, unknown>) => {
        const rettiwt = Boolean(data.rettiwt ?? false);
        const rateLimited = Boolean(data.rettiwtRateLimited ?? false);
        const cooldownSec = Number(data.rettiwtCooldownSec ?? 0);
        const sourcesBlock = (data.sources as Record<string, unknown>) ?? {};
        const arBlock =
          (sourcesBlock.agentReach as Record<string, unknown>) ?? {};
        const fpBlock =
          (sourcesBlock.feedPoller as Record<string, unknown>) ?? {};
        const next: SourceStatus = {
          supabase: Boolean(data.supabase),
          rettiwt,
          rettiwtRateLimited: rateLimited,
          rettiwtCooldownSec: cooldownSec,
          rettiwtPool: (data.rettiwtPool as RettiwtPoolStatus) ?? null,
          pollingOwner: (data.pollingOwner as string) ?? null,
          activePollers: (data.activePollers as string[]) ?? [],
          xApi: Boolean(data.xApi),
          backendReachable: true,
          lastPollSuccess: new Date().toISOString(),
          newsfeedHealthy: Boolean(data.newsfeedHealthy),
          newsfeedDegraded: Boolean(data.newsfeedDegraded),
          agentReach: {
            active: Boolean(arBlock.active),
            lastRunAt: (arBlock.lastRunAt as string | null) ?? null,
            domains:
              (arBlock.domains as Record<
                string,
                "ok" | "tripped" | "cooldown"
              >) ?? {},
          },
          feedPoller: {
            active: Boolean(fpBlock.active),
            lastRunAt: (fpBlock.lastRunAt as string | null) ?? null,
          },
          userPollStats:
            (data.userPollStats as Record<string, UserPollStat>) ?? {},
        };
        setStatus(next);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch {
          // Quota or SSR — cache is best-effort
        }
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
