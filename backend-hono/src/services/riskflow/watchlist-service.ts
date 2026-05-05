/**
 * Watchlist Service
 * User watchlist management for RiskFlow
 */

import type {
  Watchlist,
  WatchlistUpdateRequest,
  NewsSource,
} from "../../types/riskflow.js";

// In-memory watchlist store (per user)
const watchlistStore = new Map<string, Watchlist>();

// Default watchlist for new users
const defaultWatchlist: Omit<Watchlist, "userId" | "updatedAt"> = {
  keywords: [],
  sources: ["FinancialJuice", "OSINTSources", "EconomicCalendar", "Polymarket",
    "twitter:financialjuice", "twitter:DeItaone", "twitter:unusual_whales",
    "twitter:macroedgeRes", "twitter:OSINTTechnical", "twitter:nicktimiraos",
    "twitter:michaeljburry", "twitter:spotgamma", "twitter:trendspider"],
  severity: "all",
  categories: [],
  prioritySources: [],
};

/**
 * Get or create watchlist for user
 */
export function getWatchlist(userId: string): Watchlist {
  const existing = watchlistStore.get(userId);
  if (existing) return existing;

  // Create default watchlist
  const newWatchlist: Watchlist = {
    userId,
    ...defaultWatchlist,
    updatedAt: new Date().toISOString(),
  };

  watchlistStore.set(userId, newWatchlist);
  return newWatchlist;
}

/**
 * Update user watchlist
 */
export function updateWatchlist(
  userId: string,
  updates: WatchlistUpdateRequest,
): Watchlist {
  const current = getWatchlist(userId);

  const updated: Watchlist = {
    ...current,
    symbols: updates.symbols ?? current.symbols,
    tags: updates.tags ?? current.tags,
    sources: updates.sources ?? current.sources,
    updatedAt: new Date().toISOString(),
  };

  watchlistStore.set(userId, updated);
  return updated;
}

/**
 * Add symbols to watchlist
 */
export function addSymbols(userId: string, symbols: string[]): Watchlist {
  const current = getWatchlist(userId);
  const uniqueSymbols = [
    ...new Set([...current.symbols, ...symbols.map((s) => s.toUpperCase())]),
  ];
  return updateWatchlist(userId, { symbols: uniqueSymbols });
}

/**
 * Remove symbols from watchlist
 */
export function removeSymbols(userId: string, symbols: string[]): Watchlist {
  const current = getWatchlist(userId);
  const symbolSet = new Set(symbols.map((s) => s.toUpperCase()));
  const filtered = current.symbols.filter((s) => !symbolSet.has(s));
  return updateWatchlist(userId, { symbols: filtered });
}

// [claude-code 2026-04-06] Source match alone is sufficient — symbol/tag gate was hiding FJ items
// tagged with non-default keywords (LABOR, TARIFFS, etc). macroLevel scoring handles priority.
/**
 * Check if item matches watchlist filters.
 * Source match alone passes the item. Symbol/tag matching is for future
 * prioritisation, not gating.
 */
export function matchesWatchlist(
  watchlist: Watchlist,
  item: { symbols: string[]; tags: string[]; source: NewsSource },
): boolean {
  return watchlist.sources.includes(item.source);
}
