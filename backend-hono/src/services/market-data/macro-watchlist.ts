// [codex 2026-05-23] TradingView macro watchlist snapshot for agent context.
import {
  quotes,
  type QuoteRow,
  type ScannerMarket,
} from "../tradingview/scanner.js";

export interface MacroWatchSymbol {
  label: string;
  tvSymbol: string;
  yahooSymbol?: string;
  market: ScannerMarket;
  group: "equity" | "rates" | "vol" | "commodity" | "currency";
}

export interface MacroWatchQuote {
  label: string;
  tvSymbol: string;
  group: MacroWatchSymbol["group"];
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  rolling7dHigh: number | null;
  rolling7dLow: number | null;
  sparkline: Array<{ time: number; close: number }>;
  historySource: "yahoo" | "unavailable";
  asOf: string;
}

export const MACRO_WATCHLIST: MacroWatchSymbol[] = [
  {
    label: "NQ",
    tvSymbol: "CME_MINI:NQ1!",
    yahooSymbol: "NQ=F",
    market: "futures",
    group: "equity",
  },
  {
    label: "ES",
    tvSymbol: "CME_MINI:ES1!",
    yahooSymbol: "ES=F",
    market: "futures",
    group: "equity",
  },
  {
    label: "YM",
    tvSymbol: "CBOT_MINI:YM1!",
    yahooSymbol: "YM=F",
    market: "futures",
    group: "equity",
  },
  {
    label: "RTY",
    tvSymbol: "CME_MINI:RTY1!",
    yahooSymbol: "RTY=F",
    market: "futures",
    group: "equity",
  },
  {
    label: "GC",
    tvSymbol: "COMEX:GC1!",
    yahooSymbol: "GC=F",
    market: "futures",
    group: "commodity",
  },
  {
    label: "CL",
    tvSymbol: "NYMEX:CL1!",
    yahooSymbol: "CL=F",
    market: "futures",
    group: "commodity",
  },
  {
    label: "VIX",
    tvSymbol: "TVC:VIX",
    yahooSymbol: "^VIX",
    market: "america",
    group: "vol",
  },
  {
    label: "DXY",
    tvSymbol: "TVC:DXY",
    yahooSymbol: "DX-Y.NYB",
    market: "america",
    group: "currency",
  },
  { label: "US02Y", tvSymbol: "TVC:US02Y", market: "global", group: "rates" },
  {
    label: "US10Y",
    tvSymbol: "TVC:US10Y",
    yahooSymbol: "^TNX",
    market: "global",
    group: "rates",
  },
  {
    label: "US30Y",
    tvSymbol: "TVC:US30Y",
    yahooSymbol: "^TYX",
    market: "global",
    group: "rates",
  },
];

export async function fetchMacroWatchlist(): Promise<MacroWatchQuote[]> {
  const grouped = new Map<ScannerMarket, MacroWatchSymbol[]>();
  for (const item of MACRO_WATCHLIST) {
    const list = grouped.get(item.market) ?? [];
    list.push(item);
    grouped.set(item.market, list);
  }

  const batches = await Promise.all(
    [...grouped.entries()].map(async ([market, symbols]) => ({
      market,
      symbols,
      rows: await quotes(
        symbols.map((symbol) => symbol.tvSymbol),
        market,
      ),
    })),
  );

  const byTvSymbol = new Map<string, QuoteRow>();
  for (const batch of batches) {
    for (const row of batch.rows) byTvSymbol.set(row.symbol, row);
  }
  const history = await fetchYahooHistory(MACRO_WATCHLIST);

  const asOf = new Date().toISOString();
  return MACRO_WATCHLIST.map((symbol) => {
    const row = byTvSymbol.get(symbol.tvSymbol);
    if (!row || !Number.isFinite(row.close) || row.close <= 0) return null;
    const hist = history.get(symbol.label);
    return {
      label: symbol.label,
      tvSymbol: symbol.tvSymbol,
      group: symbol.group,
      price: row.close,
      change: row.changeAbs,
      changePercent: row.change,
      high: row.high,
      low: row.low,
      open: row.open,
      rolling7dHigh: hist?.high ?? null,
      rolling7dLow: hist?.low ?? null,
      sparkline: hist?.sparkline ?? [],
      historySource: hist ? "yahoo" : "unavailable",
      asOf,
    };
  }).filter((row): row is MacroWatchQuote => Boolean(row));
}

export async function buildMacroWatchlistContext(): Promise<string> {
  try {
    const rows = await fetchMacroWatchlist();
    if (rows.length === 0) return "";
    const lines = rows.map((row) => {
      const sign = row.change >= 0 ? "+" : "";
      const pctSign = row.changePercent >= 0 ? "+" : "";
      return `- ${row.label}: ${formatPrice(row.price)} (${sign}${formatPrice(row.change)}, ${pctSign}${row.changePercent.toFixed(2)}%)`;
    });
    return [
      "## Live Macro Watchlist Performance",
      `Source: TradingView scanner, as of ${rows[0]?.asOf}.`,
      ...lines,
      "Hard scope: trading analysis, directional calls, entries, stops, targets, invalidation, hedges, and tape impact must pertain only to this TradingView watchlist.",
      "External drivers, companies, sectors, countries, policy actors, or crypto catalysts may be observed as evidence, but they are not trade targets unless they map back to one of these watched symbols.",
      "Use these prices before making any futures, rates, VIX, or cross-asset claims. If a watched price is missing, say it is unavailable.",
      "When writing front-end chat responses, mention watched symbols naturally as /NQ, $ES, VIX, DXY, US02Y, US10Y, or US30Y; Streamdown will convert them into hoverable market cards.",
      'To show clickable futures/rates pills in chat, include a fenced `market-ticker-strip` JSON block with optional symbols, e.g. {"title":"Macro tape","symbols":["NQ","ES","YM","GC","CL","VIX","US02Y","US10Y"]}.',
    ].join("\n");
  } catch {
    return "";
  }
}

function formatPrice(value: number): string {
  if (Math.abs(value) >= 1000) return value.toFixed(2);
  if (Math.abs(value) >= 100) return value.toFixed(2);
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

interface YahooHistory {
  high: number;
  low: number;
  sparkline: Array<{ time: number; close: number }>;
}

async function fetchYahooHistory(
  symbols: MacroWatchSymbol[],
): Promise<Map<string, YahooHistory>> {
  const rows = await Promise.all(
    symbols.map(async (symbol) => {
      if (!symbol.yahooSymbol) return null;
      const history = await fetchYahooSymbolHistory(symbol.yahooSymbol).catch(
        () => null,
      );
      return history ? ([symbol.label, history] as const) : null;
    }),
  );
  return new Map(
    rows.filter((row): row is [string, YahooHistory] => Boolean(row)),
  );
}

async function fetchYahooSymbolHistory(
  yahooSymbol: string,
): Promise<YahooHistory | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=7d&interval=1d`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            high?: Array<number | null>;
            low?: Array<number | null>;
            close?: Array<number | null>;
          }>;
        };
      }>;
    };
  };
  const result = json.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result?.timestamp || !quote) return null;
  const highs = quote.high?.filter(isFiniteNumber) ?? [];
  const lows = quote.low?.filter(isFiniteNumber) ?? [];
  const sparkline = result.timestamp
    .map((time, index) => ({
      time: time * 1000,
      close: quote.close?.[index] ?? null,
    }))
    .filter((point): point is { time: number; close: number } =>
      isFiniteNumber(point.close),
    );
  if (highs.length === 0 || lows.length === 0 || sparkline.length === 0) {
    return null;
  }
  return {
    high: Math.max(...highs),
    low: Math.min(...lows),
    sparkline,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
