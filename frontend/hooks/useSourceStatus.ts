// [claude-code 2026-05-01] Rettiwt + Agent Reach retired. Now reads xHomeTimeline
// tier status from the riskflow-worker heartbeats (via /api/riskflow/sources).
import { useEffect, useState, useRef, useCallback } from "react";

export interface TierStatus {
  active: boolean;
  lastRunAt: string | null;
  ingested: number;
}

export interface SourceStatus {
  supabase: boolean;
  xHomeTimeline: boolean;
  breaking: TierStatus;
  standard: TierStatus;
  commentary: TierStatus;
  backendReachable: boolean;
  lastPollSuccess: string;
  newsfeedHealthy: boolean;
  newsfeedDegraded: boolean;
  methodBreakdown: Record<string, number> | null;
}

const DEFAULT_TIER: TierStatus = {
  active: false,
  lastRunAt: null,
  ingested: 0,
};

const DEFAULT_STATUS: SourceStatus = {
  supabase: false,
  xHomeTimeline: false,
  breaking: { ...DEFAULT_TIER },
  standard: { ...DEFAULT_TIER },
  commentary: { ...DEFAULT_TIER },
  backendReachable: false,
  lastPollSuccess: new Date(0).toISOString(),
  newsfeedHealthy: false,
  newsfeedDegraded: false,
  methodBreakdown: null,
};

const POLL_INTERVAL_MS = 30_000;
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const CACHE_KEY = "fintheon:sourceStatus:2";

function loadCachedStatus(): SourceStatus {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return DEFAULT_STATUS;
    const cached = JSON.parse(raw) as Partial<SourceStatus>;
    const lastPollMs = new Date(cached.lastPollSuccess ?? 0).getTime();
    if (!Number.isFinite(lastPollMs)) return DEFAULT_STATUS;
    if (Date.now() - lastPollMs > 10 * 60 * 1000) return DEFAULT_STATUS;
    return { ...DEFAULT_STATUS, ...cached } as SourceStatus;
  } catch {
    return DEFAULT_STATUS;
  }
}

function mapTierStatus(
  tiers: Record<string, unknown> | undefined,
  key: string,
): TierStatus {
  const t = (tiers?.[key] as Record<string, unknown>) ?? {};
  return {
    active: Boolean(t.active),
    lastRunAt: (t.lastRunAt as string) ?? null,
    ingested: Number(t.ingested ?? 0),
  };
}

export function useSourceStatus(): SourceStatus {
  const [status, setStatus] = useState<SourceStatus>(loadCachedStatus);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(() => {
    fetch(`${API_BASE}/api/riskflow/sources`)
      .then((r) => r.json())
      .then((data: Record<string, unknown>) => {
        const sources = (data.sources as Record<string, unknown>) ?? {};
        const timeline =
          (sources.xHomeTimeline as Record<string, unknown>) ?? {};
        const tiers = (timeline.tiers as Record<string, unknown>) ?? {};
        const next: SourceStatus = {
          supabase: Boolean(data.supabase),
          xHomeTimeline: Boolean(data.xHomeTimeline),
          breaking: mapTierStatus(tiers, "breaking"),
          standard: mapTierStatus(tiers, "standard"),
          commentary: mapTierStatus(tiers, "commentary"),
          backendReachable: true,
          lastPollSuccess: new Date().toISOString(),
          newsfeedHealthy: Boolean(data.newsfeedHealthy),
          newsfeedDegraded: Boolean(data.newsfeedDegraded),
          methodBreakdown:
            (data.method_breakdown as Record<string, number>) ?? null,
        };
        setStatus(next);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch {
          /* quota exceeded — non-critical */
        }
      })
      .catch(() => {
        setStatus((prev) => ({ ...prev, backendReachable: false }));
      });
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
