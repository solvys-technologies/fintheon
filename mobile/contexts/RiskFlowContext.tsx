// [claude-code 2026-04-15] T5: Mobile RiskFlow context — slimmed from desktop, no Notion polling, no trade ideas
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useBackend } from "@frontend/lib/backend";
import type { AlertSeverity } from "@frontend/lib/riskflow-feed";

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

const PAGE_SIZE = 20;

export function MobileRiskFlowProvider({ children }: { children: ReactNode }) {
  const backend = useBackend();
  const [alerts, setAlerts] = useState<MobileRiskFlowAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const offsetRef = useRef(0);

  const mapItems = useCallback((items: any[]): MobileRiskFlowAlert[] => {
    return items.map((item) => ({
      id: `backend-${item.id}`,
      title: item.title || "",
      content: item.summary || item.content || "",
      source: item.source || "",
      severity: macroLevelToSeverity(item.macroLevel ?? 0),
      publishedAt:
        typeof item.publishedAt === "string"
          ? item.publishedAt
          : new Date(item.publishedAt).toISOString(),
      url: item.url,
      symbols: item.symbols ?? [],
      ivScore: item.ivScore ?? null,
      subScores: item.subScores ?? null,
      agentNote: item.agentNote ?? null,
      agentNoteGeneratedAt: item.agentNoteGeneratedAt ?? null,
      authorHandle: item.authorHandle ?? null,
      econData: item.econData ?? null,
    }));
  }, []);

  const fetchInitial = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await backend.riskflow.list({
        minMacroLevel: 0,
        limit: PAGE_SIZE,
      });
      setAlerts(mapItems(response.items));
      setHasMore(response.hasMore ?? false);
      offsetRef.current = response.items.length;
    } catch (err) {
      console.warn("[MobileRiskFlow] Initial fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [backend, mapItems]);

  useEffect(() => {
    void fetchInitial();
  }, [fetchInitial]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const response = await backend.riskflow.list({
        minMacroLevel: 0,
        limit: PAGE_SIZE,
        offset: offsetRef.current,
      });
      const newAlerts = mapItems(response.items);
      setAlerts((prev) => [...prev, ...newAlerts]);
      setHasMore(response.hasMore ?? false);
      offsetRef.current += newAlerts.length;
    } catch (err) {
      console.warn("[MobileRiskFlow] loadMore error:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [backend, loadingMore, hasMore, mapItems]);

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
        isLoading,
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
