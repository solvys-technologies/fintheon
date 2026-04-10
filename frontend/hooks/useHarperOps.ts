// [claude-code 2026-04-04] Harper Ops polling hook — feeds the Harper Ops panel

import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface OpsEntry {
  id: string;
  actionType: string;
  title: string;
  detail?: string;
  severity: "info" | "warning" | "critical";
  metadata: Record<string, unknown>;
  requiresApproval: boolean;
  approvalStatus: string | null;
  createdAt: string;
}

export interface LoopStatus {
  alive: boolean;
  state: string;
  lastHeartbeat: string | null;
  lastTaskCompleted: string | null;
  queueDepth: number;
  consecutiveFailures: number;
  heartbeatCount: number;
  totalTasksCompleted: number;
}

export interface OpsStatus {
  alive: boolean;
  lastHeartbeat: string | null;
  pendingApprovals: number;
  totalEntries: number;
}

interface HarperOpsState {
  feed: OpsEntry[];
  total: number;
  status: { loop: LoopStatus; ops: OpsStatus } | null;
  loading: boolean;
  error: string | null;
  unreadCount: number;
}

const POLL_INTERVAL = 10_000; // 10 seconds

export function useHarperOps() {
  const [state, setState] = useState<HarperOpsState>({
    feed: [],
    total: 0,
    status: null,
    loading: true,
    error: null,
    unreadCount: 0,
  });

  const lastSeenCount = useRef(0);

  const fetchFeed = useCallback(async () => {
    try {
      const [feedRes, statusRes] = await Promise.all([
        fetch(`${API_BASE}/api/harper-ops/feed?limit=50`),
        fetch(`${API_BASE}/api/harper-ops/status`),
      ]);

      if (!feedRes.ok || !statusRes.ok)
        throw new Error("Failed to fetch Harper Ops data");

      const feedData = (await feedRes.json()) as {
        entries: OpsEntry[];
        total: number;
      };
      const statusData = (await statusRes.json()) as {
        loop: LoopStatus;
        ops: OpsStatus;
      };

      const newCount = feedData.total - lastSeenCount.current;
      setState((prev) => ({
        feed: feedData.entries,
        total: feedData.total,
        status: statusData,
        loading: false,
        error: null,
        unreadCount: Math.max(0, newCount),
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }, []);

  // [claude-code 2026-04-05] SSE-first with polling fallback
  const sseRef = useRef<EventSource | null>(null);
  const sseConnected = useRef(false);

  useEffect(() => {
    // Always do an initial fetch for full state (feed + status)
    fetchFeed();

    // Attempt SSE connection
    const es = new EventSource(`${API_BASE}/api/harper-ops/stream`);
    sseRef.current = es;

    es.onopen = () => {
      sseConnected.current = true;
    };

    es.onmessage = (event) => {
      if (!event.data || event.data.startsWith(":")) return;
      try {
        const entry = JSON.parse(event.data) as OpsEntry;
        setState((prev) => ({
          ...prev,
          feed: [entry, ...prev.feed.slice(0, 49)],
          total: prev.total + 1,
          unreadCount: prev.unreadCount + 1,
        }));
      } catch {
        /* ignore malformed */
      }
    };

    es.onerror = () => {
      sseConnected.current = false;
      es.close();
      sseRef.current = null;
    };

    // Polling fallback: still poll for status + full feed sync, but slower when SSE is active
    const timer = setInterval(
      () => {
        fetchFeed();
      },
      sseConnected.current ? 60_000 : POLL_INTERVAL,
    );

    return () => {
      clearInterval(timer);
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [fetchFeed]);

  const markSeen = useCallback(() => {
    lastSeenCount.current = state.total;
    setState((prev) => ({ ...prev, unreadCount: 0 }));
  }, [state.total]);

  const triggerHeartbeat = useCallback(async () => {
    await fetch(`${API_BASE}/api/harper-ops/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "heartbeat" }),
    });
    setTimeout(fetchFeed, 2000); // Refresh after 2s
  }, [fetchFeed]);

  const triggerTask = useCallback(
    async (type: string, message?: string) => {
      await fetch(`${API_BASE}/api/harper-ops/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message }),
      });
      setTimeout(fetchFeed, 2000);
    },
    [fetchFeed],
  );

  const approve = useCallback(
    async (id: string) => {
      await fetch(`${API_BASE}/api/harper-ops/approve/${id}`, {
        method: "POST",
      });
      fetchFeed();
    },
    [fetchFeed],
  );

  const deny = useCallback(
    async (id: string) => {
      await fetch(`${API_BASE}/api/harper-ops/deny/${id}`, { method: "POST" });
      fetchFeed();
    },
    [fetchFeed],
  );

  return {
    ...state,
    markSeen,
    triggerHeartbeat,
    triggerTask,
    approve,
    deny,
    refresh: fetchFeed,
  };
}
