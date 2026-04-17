// [claude-code 2026-03-31] Device-gated on-open fetch — visibility change triggers full refresh (throttled 5min)
// [claude-code 2026-03-29] Fix infinite scroll: poll uses loadedCountRef so auto-refresh doesn't reset scroll progress
// [claude-code 2026-04-16] Notion severance — backend feed is sole source
// [claude-code 2026-03-14] XCLI: minMacroLevel=0 so all items show regardless of macro level.
// [claude-code 2026-03-12] Instrument persistence: passes selectedSymbol to backend feed poll
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { RiskFlowAlert } from "../lib/riskflow-feed";
import {
  ensureScoring,
  downgradeNonFinancialBreaking,
} from "../lib/riskflow-feed";
import { useBackend } from "../lib/backend";
import { useSettings } from "./SettingsContext";
import type { RiskFlowItem } from "../types/api";

// [claude-code 2026-03-16] T2: ensureScoring + downgradeNonFinancialBreaking on merged feed

interface RiskFlowContextValue {
  alerts: RiskFlowAlert[];
  highCount: number;
  mediumCount: number;
  lowCount: number;
  clearAll: () => void;
  removeAlert: (id: string) => void;
  markSeen: (id: string) => void;
  markAllSeen: (ids: string[]) => void;
  isSeen: (id: string) => boolean;
  refresh: () => Promise<void>;
  refreshing: boolean;
  fetchStatus: string;
  loadMore: () => Promise<void>;
  loadingMore: boolean;
  hasMore: boolean;
  initialLoaded: boolean;
  /** ID of the single most-recently-arrived alert; used for one-shot flicker highlight. Auto-clears after animation. */
  freshAlertId: string | null;
}

const RiskFlowContext = createContext<RiskFlowContextValue>({
  alerts: [],
  highCount: 0,
  mediumCount: 0,
  lowCount: 0,
  clearAll: () => {},
  removeAlert: () => {},
  markSeen: () => {},
  markAllSeen: () => {},
  isSeen: () => false,
  refresh: async () => {},
  refreshing: false,
  fetchStatus: "",
  loadMore: async () => {},
  loadingMore: false,
  hasMore: false,
  initialLoaded: false,
  freshAlertId: null,
});

const BACKEND_FEED_POLL_MS = 15_000;

function macroLevelToSeverity(level: number): RiskFlowAlert["severity"] {
  if (level >= 4) return "critical";
  if (level >= 3) return "high";
  if (level >= 2) return "medium";
  return "low";
}

function mapBackendSource(source: string): RiskFlowAlert["source"] {
  const s = source.toLowerCase();
  if (s === "financialjuice") return "financial-juice";
  if (s === "osintsources") return "osint-sources";
  if (s === "economiccalendar") return "economic-calendar";
  if (s === "polymarket") return "polymarket";
  if (s === "kalshi") return "kalshi-whale";
  if (s === "twittercli" || s === "rettiwt") return "rettiwt";
  return "backend";
}

// [claude-code 2026-03-28] S9-T2: Removed dismissedIds — items are never hidden
const SEEN_STORAGE_KEY = "fintheon:riskflow-seen:v1";

function loadStoredIds(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v: unknown) => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function persistIds(key: string, ids: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore storage failures
  }
}

export function RiskFlowProvider({ children }: { children: React.ReactNode }) {
  const backend = useBackend();
  const { selectedSymbol } = useSettings();
  const [backendAlerts, setBackendAlerts] = useState<RiskFlowAlert[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(() =>
    loadStoredIds(SEEN_STORAGE_KEY),
  );
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [fetchStatus, setFetchStatus] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [freshAlertId, setFreshAlertId] = useState<string | null>(null);
  const prevAlertIdsRef = useRef<Set<string>>(new Set());
  const freshClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  // Diff each poll's alerts against the previous batch; flicker only the most-recent newcomer.
  useEffect(() => {
    const currentIds = new Set(backendAlerts.map((a) => a.id));
    const prevIds = prevAlertIdsRef.current;

    // Skip on first populated load — everything is "new" then, don't trigger a cascade.
    if (prevIds.size === 0) {
      prevAlertIdsRef.current = currentIds;
      return;
    }

    const newcomers = backendAlerts.filter((a) => !prevIds.has(a.id));
    prevAlertIdsRef.current = currentIds;
    if (newcomers.length === 0) return;

    // Pick the highest publishedAt among newcomers
    newcomers.sort((a, b) => {
      const ta = Date.parse(a.publishedAt) || 0;
      const tb = Date.parse(b.publishedAt) || 0;
      return tb - ta;
    });
    const topFresh = newcomers[0];
    setFreshAlertId(topFresh.id);

    if (freshClearTimerRef.current) clearTimeout(freshClearTimerRef.current);
    freshClearTimerRef.current = setTimeout(() => {
      setFreshAlertId(null);
    }, 1200);
  }, [backendAlerts]);

  useEffect(() => {
    return () => {
      if (freshClearTimerRef.current) clearTimeout(freshClearTimerRef.current);
    };
  }, []);
  // Track how many items have been loaded (initial 50 + loadMore pages) so polls don't reset scroll progress
  const loadedCountRef = useRef(50);

  // Backend feed polling (Rettiwt, Kalshi, Economic Calendar)
  // Uses loadedCountRef so polls fetch all items the user has scrolled through (not just first 50)
  const pollBackendFeed = useCallback(async () => {
    try {
      setFetchStatus("Fetching scored items...");
      const response = await backend.riskflow.list({
        minMacroLevel: 0,
        limit: loadedCountRef.current,
        instrument: selectedSymbol.symbol,
      });
      const alerts: RiskFlowAlert[] = response.items.map((item) => ({
        id: `backend-${item.id}`,
        headline: item.title,
        summary: item.summary || item.content || "",
        url: item.url,
        publishedAt:
          typeof item.publishedAt === "string"
            ? item.publishedAt
            : (item.publishedAt instanceof Date
                ? item.publishedAt
                : new Date(item.publishedAt)
              ).toISOString(),
        source: mapBackendSource(item.source),
        severity: macroLevelToSeverity(item.macroLevel ?? 0),
        symbols: item.symbols ?? [],
        tags: (item as RiskFlowItem & { tags?: string[] }).tags ?? [],
        isBreaking: item.isBreaking ?? false,
        pointRange: item.priceBrainScore?.impliedPoints ?? null,
        direction: item.priceBrainScore?.sentiment ?? null,
        cyclical: item.priceBrainScore?.classification ?? null,
        instrument: selectedSymbol.symbol,
        authorHandle: item.authorHandle ?? null,
        ivScore: item.ivScore ?? null,
        subScores: item.subScores ?? null,
        riskType: (item.riskType as RiskFlowAlert["riskType"]) ?? null,
        agentNote: item.agentNote ?? null,
        agentNoteGeneratedAt: item.agentNoteGeneratedAt ?? null,
        videoUrl:
          item.video_url ??
          (item.url && /youtube\.com|youtu\.be/.test(item.url)
            ? item.url
            : null),
        econData: item.econData ?? null,
        promotedAt: (item as any).promotedAt ?? null,
        narrativeThreads: (item as any).narrativeThreads ?? [],
        category: (item as any).category ?? null,
        status: (item as any).status ?? null,
        marketImpact: (item as any).marketImpact ?? null,
      }));
      setBackendAlerts(alerts);
      setHasMore(response.hasMore ?? false);
      setInitialLoaded(true);
      setFetchStatus(`${alerts.length} items loaded`);
      setTimeout(() => setFetchStatus(""), 2000);
      console.debug(
        `[RiskFlowContext] Backend feed poll: ${alerts.length} items, hasMore: ${response.hasMore} (instrument=${selectedSymbol.symbol})`,
      );
    } catch (err) {
      setFetchStatus("Feed fetch failed");
      setTimeout(() => setFetchStatus(""), 3000);
      console.warn("[RiskFlowContext] Backend feed poll error:", err);
      setInitialLoaded(true);
    }
  }, [backend, selectedSymbol.symbol]);

  // Load more items (append to existing)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const response = await backend.riskflow.list({
        minMacroLevel: 0,
        limit: 50,
        offset: backendAlerts.length,
        instrument: selectedSymbol.symbol,
      });
      const newAlerts: RiskFlowAlert[] = response.items.map((item) => ({
        id: `backend-${item.id}`,
        headline: item.title,
        summary: item.summary || item.content || "",
        url: item.url,
        publishedAt:
          typeof item.publishedAt === "string"
            ? item.publishedAt
            : (item.publishedAt instanceof Date
                ? item.publishedAt
                : new Date(item.publishedAt)
              ).toISOString(),
        source: mapBackendSource(item.source),
        severity: macroLevelToSeverity(item.macroLevel ?? 0),
        symbols: item.symbols ?? [],
        tags: (item as RiskFlowItem & { tags?: string[] }).tags ?? [],
        isBreaking: item.isBreaking ?? false,
        pointRange: item.priceBrainScore?.impliedPoints ?? null,
        direction: item.priceBrainScore?.sentiment ?? null,
        cyclical: item.priceBrainScore?.classification ?? null,
        instrument: selectedSymbol.symbol,
        authorHandle: item.authorHandle ?? null,
        ivScore: item.ivScore ?? null,
        subScores: item.subScores ?? null,
        riskType: (item.riskType as RiskFlowAlert["riskType"]) ?? null,
        agentNote: item.agentNote ?? null,
        agentNoteGeneratedAt: item.agentNoteGeneratedAt ?? null,
        videoUrl:
          item.video_url ??
          (item.url && /youtube\.com|youtu\.be/.test(item.url)
            ? item.url
            : null),
        econData: item.econData ?? null,
        promotedAt: (item as any).promotedAt ?? null,
        narrativeThreads: (item as any).narrativeThreads ?? [],
        category: (item as any).category ?? null,
        status: (item as any).status ?? null,
        marketImpact: (item as any).marketImpact ?? null,
      }));
      setBackendAlerts((prev) => [...prev, ...newAlerts]);
      setHasMore(response.hasMore ?? false);
      // Bump loaded count so subsequent polls fetch the full set
      loadedCountRef.current = backendAlerts.length + newAlerts.length;
      console.debug(
        `[RiskFlowContext] Loaded ${newAlerts.length} more items (total: ${loadedCountRef.current})`,
      );
    } catch (err) {
      console.warn("[RiskFlowContext] loadMore error:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [
    backend,
    selectedSymbol.symbol,
    backendAlerts.length,
    loadingMore,
    hasMore,
  ]);

  useEffect(() => {
    void pollBackendFeed();
    backendIntervalRef.current = setInterval(() => {
      void pollBackendFeed();
    }, BACKEND_FEED_POLL_MS);
    return () => {
      if (backendIntervalRef.current) clearInterval(backendIntervalRef.current);
    };
  }, [pollBackendFeed]);

  // Device-gated on-open fetch: when the app becomes visible (tab focus, Electron foreground),
  // trigger a refresh (backend gates X polling to owner only) then re-fetch the feed.
  // Throttled to once per 5 minutes. Non-blocking: feed poll fires immediately, refresh is fire-and-forget.
  const lastOnOpenRefresh = useRef(0);
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastOnOpenRefresh.current < 5 * 60 * 1000) return;
      lastOnOpenRefresh.current = now;
      console.debug(
        "[RiskFlowContext] App became visible — triggering on-open refresh",
      );
      // Fire refresh (may take 30s+ for owner's X poll) but don't block feed display
      backend.riskflow.refresh().catch(() => {});
      // Immediately fetch cached scored items so feed displays fast
      pollBackendFeed();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [backend, pollBackendFeed]);

  // [claude-code 2026-03-28] S9-T2: Removed 24h stalemate filter — items persist forever (backfill data)
  const merged = backendAlerts;
  // FIX 1: Ensure every item has pointRange, direction, cyclical
  ensureScoring(merged, selectedSymbol.symbol);
  // FIX 4: Downgrade non-financial BREAKING headlines
  downgradeNonFinancialBreaking(merged);
  const visibleAlerts = merged.filter((a) => !dismissedIds.has(a.id));
  const highCount = visibleAlerts.filter(
    (a) => a.severity === "high" || a.severity === "critical",
  ).length;
  const mediumCount = visibleAlerts.filter(
    (a) => a.severity === "medium",
  ).length;
  const lowCount = visibleAlerts.filter((a) => a.severity === "low").length;

  // Stabilize merged ids so clearAll doesn't change every render
  const mergedIdsRef = useRef<string[]>([]);
  const mergedIds = merged.map((a) => a.id);
  const mergedIdsKey = mergedIds.join(",");
  if (mergedIdsRef.current.join(",") !== mergedIdsKey) {
    mergedIdsRef.current = mergedIds;
  }

  // [claude-code 2026-03-28] S9-T2: clearAll/removeAlert are no-ops — items persist forever
  const clearAll = useCallback(() => {
    const ids = mergedIdsRef.current;
    setSeenIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, [mergedIdsKey]);

  const removeAlert = useCallback((id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  }, []);

  const markSeen = useCallback((id: string) => {
    if (!id) return;
    setSeenIds((prev) => {
      if (prev.has(id)) return prev;
      return new Set(prev).add(id);
    });
  }, []);

  const markAllSeen = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setSeenIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      ids.forEach((id) => {
        if (id && !next.has(id)) {
          next.add(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  const isSeen = useCallback(
    (id: string) => {
      return seenIds.has(id);
    },
    [seenIds],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setFetchStatus("Polling X feeds...");
      await backend.riskflow.refresh().catch((err: unknown) => {
        console.warn("[RiskFlow] Manual refresh failed:", err);
        setFetchStatus("Backend refresh failed — fetching cached data");
      });
      setFetchStatus("Scoring & classifying items...");
      await pollBackendFeed();
      setFetchStatus("Feed updated");
      setTimeout(() => setFetchStatus(""), 3000);
    } finally {
      setRefreshing(false);
    }
  }, [backend, pollBackendFeed]);

  useEffect(() => {
    persistIds(SEEN_STORAGE_KEY, seenIds);
  }, [seenIds]);

  return (
    <RiskFlowContext.Provider
      value={{
        alerts: visibleAlerts,
        highCount,
        mediumCount,
        lowCount,
        clearAll,
        removeAlert,
        markSeen,
        markAllSeen,
        isSeen,
        refresh,
        refreshing,
        fetchStatus,
        loadMore,
        loadingMore,
        hasMore,
        initialLoaded,
        freshAlertId,
      }}
    >
      {children}
    </RiskFlowContext.Provider>
  );
}

export function useRiskFlow(): RiskFlowContextValue {
  return useContext(RiskFlowContext);
}
