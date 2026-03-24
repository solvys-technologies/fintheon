// [claude-code 2026-03-14] Removed MarketWatch RSS polling — feed now Notion + backend only.
// [claude-code 2026-03-14] XCLI: minMacroLevel=0 so all items show regardless of macro level.
// [claude-code 2026-03-12] Instrument persistence: passes selectedSymbol to backend feed poll
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { RiskFlowAlert } from '../lib/riskflow-feed';
import { ensureScoring, downgradeNonFinancialBreaking } from '../lib/riskflow-feed';
import { useBackend } from '../lib/backend';
import { decodeHtmlEntities } from '../lib/html-entities';
import { useSettings } from './SettingsContext';
import type { NotionPollStatus } from '../lib/services';
import type { RiskFlowItem } from '../types/api';

// [claude-code 2026-03-16] Auto-refresh gating: polls skip when autoRefresh is OFF
// [claude-code 2026-03-16] T2: ensureScoring + downgradeNonFinancialBreaking on merged feed

interface RiskFlowContextValue {
  alerts: RiskFlowAlert[];
  highCount: number;
  mediumCount: number;
  lowCount: number;
  notionPollStatus: NotionPollStatus | null;
  clearAll: () => void;
  removeAlert: (id: string) => void;
  markSeen: (id: string) => void;
  markAllSeen: (ids: string[]) => void;
  isSeen: (id: string) => boolean;
  refresh: () => Promise<void>;
  refreshing: boolean;
}

const RiskFlowContext = createContext<RiskFlowContextValue>({
  alerts: [],
  highCount: 0,
  mediumCount: 0,
  lowCount: 0,
  notionPollStatus: null,
  clearAll: () => {},
  removeAlert: () => {},
  markSeen: () => {},
  markAllSeen: () => {},
  isSeen: () => false,
  refresh: async () => {},
  refreshing: false,
});

const NOTION_POLL_MS = 60_000;
const BACKEND_FEED_POLL_MS = 30_000;

function macroLevelToSeverity(level: number): RiskFlowAlert['severity'] {
  if (level >= 4) return 'critical';
  if (level >= 3) return 'high';
  if (level >= 2) return 'medium';
  return 'low';
}

function mapBackendSource(source: string): RiskFlowAlert['source'] {
  const s = source.toLowerCase();
  if (s === 'financialjuice') return 'financial-juice';
  if (s === 'insiderwire') return 'insider-wire';
  if (s === 'economiccalendar') return 'economic-calendar';
  if (s === 'polymarket') return 'polymarket';
  if (s === 'kalshi') return 'kalshi-whale';
  if (s === 'twittercli') return 'twitter-cli';
  return 'backend';
}

const DISMISSED_STORAGE_KEY = 'fintheon:riskflow-dismissed:v1';
const SEEN_STORAGE_KEY = 'fintheon:riskflow-seen:v1';

function loadStoredIds(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v: unknown) => typeof v === 'string'));
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
  const { selectedSymbol, autoRefresh } = useSettings();
  const [notionAlerts, setNotionAlerts] = useState<RiskFlowAlert[]>([]);
  const [backendAlerts, setBackendAlerts] = useState<RiskFlowAlert[]>([]);
  const [notionPollStatus, setNotionPollStatus] = useState<NotionPollStatus | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => loadStoredIds(DISMISSED_STORAGE_KEY));
  const [seenIds, setSeenIds] = useState<Set<string>>(() => loadStoredIds(SEEN_STORAGE_KEY));
  const [refreshing, setRefreshing] = useState(false);
  const notionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Notion trade idea polling
  const pollNotion = useCallback(async () => {
    try {
      const [ideas, pollStatus] = await Promise.all([
        backend.notion.getTradeIdeas(),
        backend.notion.getPollStatus(),
      ]);
      const converted: RiskFlowAlert[] = ideas.map((idea) => {
        const displayName = idea.title || idea.ticker || 'Trade Idea';
        return {
        id: `notion-ti-${idea.id}`,
        headline: decodeHtmlEntities(`${idea.direction.toUpperCase()} — ${displayName}${idea.entry ? ` @ ${idea.entry}` : ''}`),
        summary: decodeHtmlEntities(
          idea.hermesDescription
          ?? `${displayName} — ${idea.direction} trade idea${idea.confidence ? ` (${idea.confidence} confidence)` : ''}`
        ),
        url: idea.notionUrl,
        publishedAt: idea.createdAt,
        source: 'notion-trade-idea' as const,
        severity: (idea.confidence === 'high' || idea.confidence === 'max') ? 'high'
          : idea.confidence === 'medium' ? 'medium' : 'low',
        tags: [idea.direction, idea.timeframe ?? ''].filter(Boolean),
        tradeIdea: {
          title: displayName,
          ticker: idea.ticker || displayName,
          direction: idea.direction,
          entry: idea.entry,
          stopLoss: idea.stopLoss,
          takeProfit: idea.takeProfit,
          potentialRisk: idea.potentialRisk,
          potentialProfit: idea.potentialProfit,
          riskRewardRatio: idea.riskRewardRatio,
          confidence: idea.confidence,
          timeframe: idea.timeframe,
          sourceAgent: idea.sourceAgent,
          hermesDescription: idea.hermesDescription,
          notionUrl: idea.notionUrl,
        },
      };
      });
      setNotionAlerts(converted);
      setNotionPollStatus(pollStatus);
      console.debug(
        `[RiskFlowContext] Notion poll: ${ideas.length} proposals (cache=${pollStatus.tradeIdeaCount}, running=${pollStatus.running})`
      );
    } catch (err) {
      console.warn('[RiskFlowContext] Notion poll error:', err);
    }
  }, [backend]);

  useEffect(() => {
    void pollNotion();
    notionIntervalRef.current = setInterval(() => {
      if (!autoRefresh) return;
      void pollNotion();
    }, NOTION_POLL_MS);
    return () => {
      if (notionIntervalRef.current) clearInterval(notionIntervalRef.current);
    };
  }, [pollNotion, autoRefresh]);

  // Backend feed polling (twitter-cli, Polymarket, Economic Calendar)
  const pollBackendFeed = useCallback(async () => {
    try {
      const response = await backend.riskflow.list({ minMacroLevel: 0, limit: 30, instrument: selectedSymbol.symbol });
      const alerts: RiskFlowAlert[] = response.items.map((item) => ({
        id: `backend-${item.id}`,
        headline: item.title,
        summary: item.summary || item.content || '',
        url: item.url,
        publishedAt:
          typeof item.publishedAt === 'string'
            ? item.publishedAt
            : (item.publishedAt instanceof Date ? item.publishedAt : new Date(item.publishedAt)).toISOString(),
        source: mapBackendSource(item.source),
        severity: macroLevelToSeverity(item.macroLevel ?? 0),
        symbols: item.symbols ?? [],
        tags: (item as RiskFlowItem & { tags?: string[] }).tags ?? [],
        isBreaking: item.isBreaking ?? false,
        pointRange: item.priceBrainScore?.impliedPoints ?? null,
        direction: item.priceBrainScore?.sentiment ?? null,
        cyclical: item.priceBrainScore?.classification ?? null,
        instrument: item.priceBrainScore?.instrument ?? null,
        authorHandle: item.authorHandle ?? null,
      }));
      setBackendAlerts(alerts);
      console.debug(`[RiskFlowContext] Backend feed poll: ${alerts.length} items (instrument=${selectedSymbol.symbol})`);
    } catch (err) {
      console.warn('[RiskFlowContext] Backend feed poll error:', err);
    }
  }, [backend, selectedSymbol.symbol]);

  useEffect(() => {
    void pollBackendFeed();
    backendIntervalRef.current = setInterval(() => {
      if (!autoRefresh) return;
      void pollBackendFeed();
    }, BACKEND_FEED_POLL_MS);
    return () => {
      if (backendIntervalRef.current) clearInterval(backendIntervalRef.current);
    };
  }, [pollBackendFeed, autoRefresh]);

  // Merge: Notion (pinned) → Backend feed
  // [claude-code 2026-03-11] 24h stalemate rule: drop items older than 24h on init/render
  const STALE_CUTOFF_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const isFresh = (a: RiskFlowAlert) => {
    if (!a.publishedAt) return true;
    return now - new Date(a.publishedAt).getTime() < STALE_CUTOFF_MS;
  };

  const seenBackendIds = new Set(notionAlerts.map((a) => a.id));
  const dedupedBackend = backendAlerts.filter((a) => !seenBackendIds.has(a.id));
  const merged = [...notionAlerts, ...dedupedBackend].filter(isFresh);
  // FIX 1: Ensure every item has pointRange, direction, cyclical
  ensureScoring(merged, selectedSymbol.symbol);
  // FIX 4: Downgrade non-financial BREAKING headlines
  downgradeNonFinancialBreaking(merged);
  const visibleAlerts = merged.filter((a) => !dismissedIds.has(a.id));
  const highCount = visibleAlerts.filter((a) => a.severity === 'high' || a.severity === 'critical').length;
  const mediumCount = visibleAlerts.filter((a) => a.severity === 'medium').length;
  const lowCount = visibleAlerts.filter((a) => a.severity === 'low').length;

  const clearAll = useCallback(() => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      merged.forEach((a) => next.add(a.id));
      return next;
    });
    setSeenIds((prev) => {
      const next = new Set(prev);
      merged.forEach((a) => next.add(a.id));
      return next;
    });
  }, [merged]);

  const removeAlert = useCallback((id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
    setSeenIds((prev) => new Set(prev).add(id));
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

  const isSeen = useCallback((id: string) => {
    return seenIds.has(id);
  }, [seenIds]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Trigger backend to poll sources for fresh items
      await backend.riskflow.refresh().catch((err: unknown) => {
        console.warn('[RiskFlow] Manual refresh failed:', err);
      });
      // Re-fetch both sources in parallel
      await Promise.all([
        pollNotion(),
        pollBackendFeed(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [backend, pollNotion, pollBackendFeed]);

  useEffect(() => {
    persistIds(DISMISSED_STORAGE_KEY, dismissedIds);
  }, [dismissedIds]);

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
        notionPollStatus,
        clearAll,
        removeAlert,
        markSeen,
        markAllSeen,
        isSeen,
        refresh,
        refreshing,
      }}
    >
      {children}
    </RiskFlowContext.Provider>
  );
}

export function useRiskFlow(): RiskFlowContextValue {
  return useContext(RiskFlowContext);
}
