// [claude-code 2026-04-25] S40-P7/P8: 12-ticker megacap watchlist (NDX∩SPX>$300B).
// Hand-curated; refresh quarterly. Order = current market-cap rank (Apr 2026).
//
// Used by:
//   - Pillar 7 megacap-analyst (boardroom dispatch on earnings + M&A)
//   - Pillar 8 earnings ingestion (FMP filter)
//   - Pillar 6 Time-To-Print eligibility list

export const MEGACAP_TICKERS = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "NVDA",
  "META",
  "TSLA",
  "AVGO",
  "COST",
  "NFLX",
  "ADBE",
  "ORCL",
] as const;

export type MegacapTicker = (typeof MEGACAP_TICKERS)[number];

export function isMegacap(symbol: string): symbol is MegacapTicker {
  return (MEGACAP_TICKERS as readonly string[]).includes(symbol.toUpperCase());
}

export const MEGACAP_TICKER_SET: ReadonlySet<string> = new Set(MEGACAP_TICKERS);
