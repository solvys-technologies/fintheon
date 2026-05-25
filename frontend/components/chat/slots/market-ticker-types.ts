import { z } from "zod";

export const MarketTickerQuoteSchema = z.object({
  label: z.string(),
  tvSymbol: z.string(),
  group: z.string(),
  price: z.number(),
  change: z.number(),
  changePercent: z.number(),
  high: z.number(),
  low: z.number(),
  open: z.number(),
  rolling7dHigh: z.number().nullable().optional(),
  rolling7dLow: z.number().nullable().optional(),
  sparkline: z.array(z.object({ time: z.number(), close: z.number() })).default([]),
  historySource: z.enum(["yahoo", "unavailable"]).optional(),
  asOf: z.string(),
});

export type MarketTickerQuote = z.infer<typeof MarketTickerQuoteSchema>;

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

let quoteCache: Promise<MarketTickerQuote[]> | null = null;

export function fetchMarketTickerQuotes(): Promise<MarketTickerQuote[]> {
  quoteCache ??= fetch(`${API_BASE}/api/market-scan/macro-watchlist`)
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => z.array(MarketTickerQuoteSchema).parse(json?.data ?? []))
    .catch(() => []);
  return quoteCache;
}

export function normalizeTickerSymbol(value: unknown): string {
  return String(value ?? "")
    .replace(/^[/$]/, "")
    .toUpperCase();
}

export function formatPrice(value: number): string {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (Math.abs(value) >= 100) return value.toFixed(2);
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${formatPrice(value)}`;
}

export function formatSignedPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
