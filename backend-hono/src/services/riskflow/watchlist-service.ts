/**
 * Watchlist Service
 * User watchlist management for RiskFlow
 */

import type { Watchlist, WatchlistUpdateRequest, NewsSource } from '../../types/riskflow.js';

// In-memory watchlist store (per user)
const watchlistStore = new Map<string, Watchlist>();

// Default watchlist for new users
const defaultWatchlist: Omit<Watchlist, 'userId' | 'updatedAt'> = {
  symbols: ['ES', 'NQ', 'SPY', 'QQQ'],
  tags: ['CPI', 'PPI', 'NFP', 'FOMC', 'FED', 'ECON_DATA', 'KALSHI', 'WHALE', 'POLYMARKET', 'ODDS'],
  sources: ['FinancialJuice', 'InsiderWire', 'EconomicCalendar', 'Polymarket', 'Kalshi', 'TwitterCli'],
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
  updates: WatchlistUpdateRequest
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
  const uniqueSymbols = [...new Set([...current.symbols, ...symbols.map(s => s.toUpperCase())])];
  return updateWatchlist(userId, { symbols: uniqueSymbols });
}

/**
 * Remove symbols from watchlist
 */
export function removeSymbols(userId: string, symbols: string[]): Watchlist {
  const current = getWatchlist(userId);
  const symbolSet = new Set(symbols.map(s => s.toUpperCase()));
  const filtered = current.symbols.filter(s => !symbolSet.has(s));
  return updateWatchlist(userId, { symbols: filtered });
}

/**
 * Check if item matches watchlist filters
 */
export function matchesWatchlist(
  watchlist: Watchlist,
  item: { symbols: string[]; tags: string[]; source: NewsSource }
): boolean {
  // Check source filter
  if (!watchlist.sources.includes(item.source)) {
    return false;
  }

  // Check symbol overlap
  const hasMatchingSymbol = item.symbols.some(s =>
    watchlist.symbols.includes(s.toUpperCase())
  );

  // Check tag overlap
  const hasMatchingTag = item.tags.some(t =>
    watchlist.tags.includes(t.toUpperCase())
  );

  // Match if any symbol or tag matches (or if item has no symbols/tags)
  return hasMatchingSymbol || hasMatchingTag || (item.symbols.length === 0 && item.tags.length === 0);
}
