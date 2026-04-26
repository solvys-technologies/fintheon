// [claude-code 2026-04-25] S40-P9: ConsulBrowserContext — single source of
// truth for Consul Browser pane state across surfaces (Consilium chat,
// Strategium, etc). Subscribes to /api/browserbase/stream and holds
// { active, liveUrl, sessionId, dayCount, dayCap }.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface ConsulBrowserSession {
  id: string;
  liveUrl: string;
  createdAt: string;
}

interface ConsulBrowserStats {
  active: boolean;
  dayCount: number;
  dayCap: number;
  idleTtlMs: number;
}

interface ConsulBrowserContextValue {
  session: ConsulBrowserSession | null;
  stats: ConsulBrowserStats;
  isLoading: boolean;
  open: () => Promise<void>;
  close: () => Promise<void>;
  navigate: (url: string) => Promise<void>;
}

const DEFAULT_STATS: ConsulBrowserStats = {
  active: false,
  dayCount: 0,
  dayCap: 4,
  idleTtlMs: 15 * 60_000,
};

const ConsulBrowserContext = createContext<ConsulBrowserContextValue | null>(
  null,
);

export function ConsulBrowserProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ConsulBrowserSession | null>(null);
  const [stats, setStats] = useState<ConsulBrowserStats>(DEFAULT_STATS);
  const [isLoading, setLoading] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const refreshActive = useCallback(async () => {
    try {
      const res = await fetch("/api/browserbase/sessions/active");
      if (!res.ok) return;
      const data = (await res.json()) as {
        session: ConsulBrowserSession | null;
        stats: ConsulBrowserStats;
      };
      setSession(data.session);
      setStats(data.stats ?? DEFAULT_STATS);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    void refreshActive();
  }, [refreshActive]);

  // SSE subscription — backend pushes state changes when Harper drives the
  // session via the consul_browser tool.
  useEffect(() => {
    let cancelled = false;
    const connect = () => {
      if (cancelled) return;
      const es = new EventSource("/api/browserbase/stream");
      esRef.current = es;
      es.addEventListener("consul-browser", (msg) => {
        try {
          const payload = JSON.parse((msg as MessageEvent).data) as {
            state: "active" | "closed" | "navigated" | "extracted";
            session: { id: string; liveUrl: string } | null;
          };
          if (payload.state === "closed") {
            setSession(null);
          } else if (payload.session) {
            setSession((prev) => ({
              id: payload.session!.id,
              liveUrl: payload.session!.liveUrl,
              createdAt: prev?.createdAt ?? new Date().toISOString(),
            }));
          }
          // Refresh stats off the back of state changes.
          void refreshActive();
        } catch {
          /* ignore malformed frame */
        }
      });
      es.addEventListener("error", () => {
        es.close();
        if (!cancelled) setTimeout(connect, 5_000);
      });
    };
    connect();
    return () => {
      cancelled = true;
      esRef.current?.close();
    };
  }, [refreshActive]);

  const open = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/browserbase/sessions", { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as {
          session: ConsulBrowserSession;
          stats: ConsulBrowserStats;
        };
        setSession(data.session);
        setStats(data.stats ?? DEFAULT_STATS);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const close = useCallback(async () => {
    setLoading(true);
    try {
      await fetch("/api/browserbase/sessions/active", { method: "DELETE" });
      setSession(null);
      await refreshActive();
    } finally {
      setLoading(false);
    }
  }, [refreshActive]);

  const navigate = useCallback(
    async (url: string) => {
      if (!session) await open();
      await fetch("/api/browserbase/sessions/active/navigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
    },
    [session, open],
  );

  const value = useMemo<ConsulBrowserContextValue>(
    () => ({ session, stats, isLoading, open, close, navigate }),
    [session, stats, isLoading, open, close, navigate],
  );

  return (
    <ConsulBrowserContext.Provider value={value}>
      {children}
    </ConsulBrowserContext.Provider>
  );
}

export function useConsulBrowser(): ConsulBrowserContextValue {
  const ctx = useContext(ConsulBrowserContext);
  if (!ctx) {
    throw new Error(
      "useConsulBrowser must be used within ConsulBrowserProvider",
    );
  }
  return ctx;
}
