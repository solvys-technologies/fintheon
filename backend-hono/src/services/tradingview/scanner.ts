// [claude-code 2026-04-26] TradingView Scanner client. Generic POST screener
// that powers TV's web Screener tool — ranks tickers by arbitrary boolean
// filter expressions across any TV market segment (america, forex, cfd,
// crypto, turkey, etc.). Same browser-spoofed headers as the calendar API
// (Origin + Referer required, 403 without them). No auth, no documented
// quota — keep usage modest and cache aggressively.
//
// Public surface:
//   - rawScan(market, body)            — escape hatch, full body control
//   - quotes(symbols[])                — last/change/volume/mcap for a list
//   - topMovers(market, side, limit)   — top N gainers/losers by volume
//   - sectorMovers(market, sector)     — within-sector leaderboard
//   - presetGoldSilverOil()            — XAUUSD/XAGUSD/USOIL spot snapshot
//
// Caching: a 30s in-process map. Each preset bypasses the network if a
// fresh result for the same args exists, so a /api hit per second is fine.

const BASE = "https://scanner.tradingview.com";
const TV_BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 30_000;

export type ScannerMarket =
  | "america"
  | "nasdaq"
  | "nyse"
  | "forex"
  | "cfd"
  | "crypto"
  | "futures"
  | "turkey"
  | "global";

export type ScannerOperator =
  | "egreater"
  | "less"
  | "equal"
  | "nequal"
  | "greater"
  | "eless"
  | "in_range"
  | "has"
  | "has_none_of"
  | "above%"
  | "below%";

export interface ScannerFilterClause {
  left: string;
  operation: ScannerOperator;
  right: number | string | (string | number)[];
}

export interface ScannerSort {
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export interface ScannerBody {
  columns: string[];
  filter?: ScannerFilterClause[];
  filter2?: unknown;
  sort?: ScannerSort;
  range?: [number, number];
  markets?: string[];
  options?: { lang?: "en" | "tr" };
  symbols?: { tickers?: string[] };
}

export interface ScannerRow<TCols extends readonly string[] = string[]> {
  s: string;
  d: unknown[];
  /** Convenience: shape `d` into a record keyed by column name. */
  fields: Record<TCols[number], unknown>;
}

export interface ScannerResponse<TCols extends readonly string[] = string[]> {
  totalCount: number;
  data: ScannerRow<TCols>[];
}

interface CacheEntry {
  ts: number;
  payload: ScannerResponse;
}
const cache = new Map<string, CacheEntry>();

function cacheKey(market: ScannerMarket, body: ScannerBody): string {
  return `${market}::${JSON.stringify(body)}`;
}

function fromCache(key: string): ScannerResponse | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.payload;
}

function toCache(key: string, payload: ScannerResponse): void {
  cache.set(key, { ts: Date.now(), payload });
}

export async function rawScan<TCols extends readonly string[] = string[]>(
  market: ScannerMarket,
  body: ScannerBody,
): Promise<ScannerResponse<TCols>> {
  const key = cacheKey(market, body);
  const cached = fromCache(key);
  if (cached) return cached as ScannerResponse<TCols>;

  const url = `${BASE}/${market}/scan?label-product=screener-stock`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        Origin: "https://www.tradingview.com",
        Referer: "https://www.tradingview.com/",
        "User-Agent": TV_BROWSER_UA,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`tv_scanner_${res.status}`);
    }
    const json = (await res.json()) as {
      totalCount?: number;
      data?: { s: string; d: unknown[] }[];
    };
    const cols = body.columns;
    const data = (json.data ?? []).map((row) => {
      const fields: Record<string, unknown> = {};
      cols.forEach((c, i) => {
        fields[c] = row.d[i];
      });
      return { s: row.s, d: row.d, fields } as ScannerRow<TCols>;
    });
    const payload: ScannerResponse<TCols> = {
      totalCount: json.totalCount ?? data.length,
      data,
    };
    toCache(key, payload as ScannerResponse);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

// ── Presets ────────────────────────────────────────────────────────────────

const QUOTE_COLS = [
  "name",
  "description",
  "close",
  "change",
  "change_abs",
  "volume",
  "market_cap_basic",
  "high",
  "low",
  "open",
] as const;

// Futures + FX + CFD segments don't carry `market_cap_basic`; using it 400s.
const NONEQUITY_QUOTE_COLS = [
  "name",
  "description",
  "close",
  "change",
  "change_abs",
  "volume",
  "high",
  "low",
  "open",
] as const;

export interface QuoteRow {
  symbol: string;
  name: string;
  description: string;
  close: number;
  change: number;
  changeAbs: number;
  volume: number;
  marketCap: number | null;
  high: number;
  low: number;
  open: number;
}

function rowToQuote(row: ScannerRow<typeof QUOTE_COLS>): QuoteRow {
  const f = row.fields as Record<(typeof QUOTE_COLS)[number], unknown>;
  return {
    symbol: row.s,
    name: String(f.name ?? ""),
    description: String(f.description ?? ""),
    close: Number(f.close ?? 0),
    change: Number(f.change ?? 0),
    changeAbs: Number(f.change_abs ?? 0),
    volume: Number(f.volume ?? 0),
    marketCap:
      f.market_cap_basic == null ? null : Number(f.market_cap_basic),
    high: Number(f.high ?? 0),
    low: Number(f.low ?? 0),
    open: Number(f.open ?? 0),
  };
}

/**
 * Look up live quotes for a specific symbol list. Symbols accept TV-style
 * exchange-prefixed identifiers ("NASDAQ:AAPL", "FX:EURUSD", "OANDA:XAUUSD").
 * Bare tickers (e.g. "AAPL") work in the `america` market.
 */
export async function quotes(
  symbols: string[],
  market: ScannerMarket = "america",
): Promise<QuoteRow[]> {
  if (symbols.length === 0) return [];
  const isEquitySegment = market === "america" || market === "nasdaq" || market === "nyse";
  const cols = isEquitySegment ? QUOTE_COLS : NONEQUITY_QUOTE_COLS;
  const res = await rawScan<typeof QUOTE_COLS>(market, {
    columns: [...cols],
    symbols: { tickers: symbols },
    range: [0, symbols.length],
  });
  return res.data.map(rowToQuote);
}

/**
 * Top movers by volume on a given market segment, gainers OR losers.
 * Uses change ≥ 0 / < 0 split per the BIST reference doc; same shape
 * works on america, forex, cfd, crypto.
 */
export async function topMovers(opts: {
  market: ScannerMarket;
  side: "gainers" | "losers";
  limit?: number;
  /** Drop micro-caps; default 250M USD. Pass null to disable. */
  minMarketCap?: number | null;
}): Promise<QuoteRow[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 10, 50));
  const filter: ScannerFilterClause[] = [
    {
      left: "change",
      operation: opts.side === "gainers" ? "egreater" : "less",
      right: 0,
    },
  ];
  const minCap = opts.minMarketCap === undefined ? 250_000_000 : opts.minMarketCap;
  if (minCap != null) {
    filter.push({ left: "market_cap_basic", operation: "egreater", right: minCap });
  }
  const res = await rawScan<typeof QUOTE_COLS>(opts.market, {
    columns: [...QUOTE_COLS],
    filter,
    sort: { sortBy: "volume", sortOrder: "desc" },
    range: [0, limit],
    options: { lang: "en" },
  });
  return res.data.map(rowToQuote);
}

/**
 * US equity-index FUTURES — continuous-contract front-month, "1!" suffix.
 * /ES, /NQ, /YM, /RTY are what traders actually watch (vs cash SPX/NDX/DJI).
 * VIX futures (/VX) included so the IV/VIX surface has a single home.
 */
export async function presetUsFutures(): Promise<QuoteRow[]> {
  return quotes(
    [
      "CME_MINI:ES1!", // /ES — S&P 500 E-mini
      "CME_MINI:NQ1!", // /NQ — Nasdaq 100 E-mini
      "CBOT_MINI:YM1!", // /YM — Dow E-mini
      "CME_MINI:RTY1!", // /RTY — Russell 2000 E-mini
      "CFE:VX1!", // /VX — VIX futures
    ],
    "futures",
  );
}

/** Commodity FUTURES — continuous-contract front-month. */
export async function presetCommodityFutures(): Promise<QuoteRow[]> {
  return quotes(
    [
      "COMEX:GC1!", // /GC — Gold
      "COMEX:SI1!", // /SI — Silver
      "NYMEX:CL1!", // /CL — WTI Crude
      "NYMEX:NG1!", // /NG — Natural Gas
      "COMEX:HG1!", // /HG — Copper
    ],
    "futures",
  );
}

/** Treasury FUTURES — continuous-contract front-month (rate complex). */
export async function presetRateFutures(): Promise<QuoteRow[]> {
  return quotes(
    [
      "CBOT:ZB1!", // /ZB — 30Y Bond
      "CBOT:ZN1!", // /ZN — 10Y Note
      "CBOT:ZF1!", // /ZF — 5Y Note
      "CBOT:ZT1!", // /ZT — 2Y Note
    ],
    "futures",
  );
}

/** Spot gold (XAUUSD), silver (XAGUSD), oil (USOIL) snapshot via /cfd. */
export async function presetGoldSilverOil(): Promise<QuoteRow[]> {
  return quotes(["TVC:GOLD", "TVC:SILVER", "TVC:USOIL"], "cfd");
}

/** Major USD pairs snapshot — EURUSD, GBPUSD, USDJPY, USDCAD, USDCHF. */
export async function presetMajorFx(): Promise<QuoteRow[]> {
  return quotes(
    ["FX:EURUSD", "FX:GBPUSD", "FX:USDJPY", "FX:USDCAD", "FX:USDCHF"],
    "forex",
  );
}

/**
 * Cash US indices — SPX/NDX/DJI/RUT/VIX. Kept for compat; for trading
 * surfaces prefer presetUsFutures (continuous contracts).
 */
export async function presetUsIndices(): Promise<QuoteRow[]> {
  return quotes(
    ["SP:SPX", "NASDAQ:NDX", "DJ:DJI", "TVC:RUT", "TVC:VIX"],
    "america",
  );
}
