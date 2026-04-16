// [claude-code 2026-04-16] Rewrite: direct fetch() bypassing ApiClient, localStorage cache, no Agent Reach
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { AlertSeverity } from "@frontend/lib/riskflow-feed";

const API_BASE = import.meta.env.VITE_API_URL || "";
const CACHE_KEY = "riskflow-cache";
const PAGE_SIZE = 20;

export interface MobileRiskFlowAlert {
  id: string;
  title: string;
  content: string;
  source: string;
  severity: AlertSeverity;
  publishedAt: string;
  url?: string;
  symbols?: string[];
  ivScore?: number | null;
  direction?: string | null;
  subScores?: {
    eventWeight: number;
    timing: number;
    deviation: number;
    momentum: number;
    vixContext: number;
    vixMultiplier: number;
  } | null;
  agentNote?: string | null;
  agentNoteGeneratedAt?: string | null;
  authorHandle?: string | null;
  econData?: {
    actual?: number | null;
    forecast?: number | null;
    previous?: number | null;
    beatMiss?: "beat" | "miss" | "inline" | null;
    surprisePercent?: number | null;
  } | null;
}

function macroLevelToSeverity(level: number): AlertSeverity {
  if (level >= 4) return "critical";
  if (level >= 3) return "high";
  if (level >= 2) return "medium";
  return "low";
}

function mapRawItems(items: any[]): MobileRiskFlowAlert[] {
  return items.map((item) => ({
    id: `backend-${item.id}`,
    title: item.headline || item.title || "",
    content: item.body || item.summary || item.content || "",
    source: item.source || "",
    severity: macroLevelToSeverity(item.macroLevel ?? 0),
    publishedAt:
      typeof item.publishedAt === "string"
        ? item.publishedAt
        : new Date(item.publishedAt).toISOString(),
    url: item.url,
    symbols: item.symbols ?? [],
    ivScore: item.ivScore ?? null,
    direction: item.direction ?? null,
    subScores: item.subScores ?? null,
    agentNote: item.agentNote ?? null,
    agentNoteGeneratedAt: item.agentNoteGeneratedAt ?? null,
    authorHandle: item.authorHandle ?? null,
    econData: item.econData ?? null,
  }));
}

function readCache(): MobileRiskFlowAlert[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeCache(items: MobileRiskFlowAlert[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(items.slice(0, 40)));
  } catch {
    // Storage full or unavailable
  }
}

async function fetchFeed(
  offset = 0,
  limit = PAGE_SIZE,
): Promise<{ items: any[]; hasMore: boolean; total: number }> {
  const res = await fetch(
    `${API_BASE}/api/riskflow/feed?minMacroLevel=0&limit=${limit}&offset=${offset}`,
  );
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
  const data = await res.json();
  return {
    items: Array.isArray(data.items) ? data.items : [],
    hasMore: data.hasMore ?? false,
    total: data.total ?? 0,
  };
}

interface RiskFlowContextValue {
  alerts: MobileRiskFlowAlert[];
  isLoading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  markSeen: (id: string) => void;
  removeAlert: (id: string) => void;
}

const RiskFlowContext = createContext<RiskFlowContextValue | undefined>(
  undefined,
);

export function MobileRiskFlowProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<MobileRiskFlowAlert[]>(() =>
    readCache(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const offsetRef = useRef(0);

  const fetchInitial = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchFeed(0, PAGE_SIZE);
      const mapped = mapRawItems(response.items);
      setAlerts(mapped);
      writeCache(mapped);
      setHasMore(response.hasMore);
      offsetRef.current = response.items.length;
    } catch (err) {
      console.warn("[MobileRiskFlow] fetch error:", err);
      // Keep cached items visible on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInitial();
  }, [fetchInitial]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const response = await fetchFeed(offsetRef.current, PAGE_SIZE);
      const newAlerts = mapRawItems(response.items);
      setAlerts((prev) => {
        const updated = [...prev, ...newAlerts];
        writeCache(updated);
        return updated;
      });
      setHasMore(response.hasMore);
      offsetRef.current += newAlerts.length;
    } catch (err) {
      console.warn("[MobileRiskFlow] loadMore error:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  const refresh = useCallback(async () => {
    offsetRef.current = 0;
    setDismissedIds(new Set());
    await fetchInitial();
  }, [fetchInitial]);

  const markSeen = useCallback((_id: string) => {}, []);
  const removeAlert = useCallback((id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  }, []);

  const visible = alerts.filter((a) => !dismissedIds.has(a.id));
  const criticalCount = visible.filter((a) => a.severity === "critical").length;
  const highCount = visible.filter((a) => a.severity === "high").length;
  const mediumCount = visible.filter((a) => a.severity === "medium").length;
  const lowCount = visible.filter((a) => a.severity === "low").length;

  return (
    <RiskFlowContext.Provider
      value={{
        alerts: visible,
        isLoading: isLoading && alerts.length === 0,
        loadingMore,
        hasMore,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        loadMore,
        refresh,
        markSeen,
        removeAlert,
      }}
    >
      {children}
    </RiskFlowContext.Provider>
  );
}

export function useMobileRiskFlow(): RiskFlowContextValue {
  const ctx = useContext(RiskFlowContext);
  if (!ctx)
    throw new Error(
      "useMobileRiskFlow must be used within MobileRiskFlowProvider",
    );
  return ctx;
}
