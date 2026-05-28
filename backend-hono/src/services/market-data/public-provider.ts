// [Codex 2026-05-27] Public.com read-only market-data provider boundary.

export type PublicInstrumentType = "EQUITY" | "OPTION" | "CRYPTO" | "INDEX";

export interface PublicBarPoint {
  time: number;
  close: number;
  high: number;
  low: number;
}

export interface PublicInstrumentRef {
  symbol: string;
  type: PublicInstrumentType;
}

interface PublicBarsResponse {
  preMarket?: { bars?: PublicRawBar[] };
  regularMarket?: { bars?: PublicRawBar[] };
  afterMarket?: { bars?: PublicRawBar[] };
}

interface PublicRawBar {
  timestamp?: string;
  close?: string;
  high?: string;
  low?: string;
}

const PUBLIC_API_BASE = process.env.PUBLIC_API_BASE || "https://api.public.com";

export function hasPublicMarketDataCredentials(): boolean {
  return Boolean(process.env.PUBLIC_API_KEY?.trim());
}

export function hasPublicAccountMarketDataCredentials(): boolean {
  return Boolean(
    process.env.PUBLIC_API_KEY?.trim() && process.env.PUBLIC_ACCOUNT_ID?.trim(),
  );
}

export async function fetchPublicQuotes(
  instruments: PublicInstrumentRef[],
): Promise<unknown[] | null> {
  const accountId = process.env.PUBLIC_ACCOUNT_ID?.trim();
  if (!accountId || instruments.length === 0) return null;
  const json = await postPublicAccountMarketData(accountId, "quotes", {
    instruments,
  });
  return Array.isArray((json as { quotes?: unknown[] })?.quotes)
    ? (json as { quotes: unknown[] }).quotes
    : null;
}

export async function fetchPublicOptionChain(input: {
  instrument: PublicInstrumentRef;
  expirationDate: string;
}): Promise<unknown | null> {
  const accountId = process.env.PUBLIC_ACCOUNT_ID?.trim();
  if (!accountId) return null;
  return postPublicAccountMarketData(accountId, "option-chain", input);
}

export async function fetchPublicBars(input: {
  symbol: string;
  type: PublicInstrumentType;
  period: "DAY" | "WEEK";
  aggregation: "ONE_DAY" | "ONE_HOUR" | "FIVE_MINUTES";
}): Promise<PublicBarPoint[] | null> {
  const token = process.env.PUBLIC_API_KEY?.trim();
  if (!token) return null;

  const path = [
    "userapigateway",
    "historicdata",
    encodeURIComponent(input.type),
    encodeURIComponent(input.symbol),
    encodeURIComponent(input.period),
    encodeURIComponent(input.aggregation),
  ].join("/");
  const res = await fetch(`${PUBLIC_API_BASE}/${path}`, {
    signal: AbortSignal.timeout(8000),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": "fintheon-public-market-data",
    },
  });
  if (!res.ok) return null;

  const json = (await res.json()) as PublicBarsResponse;
  const bars = [
    ...(json.preMarket?.bars ?? []),
    ...(json.regularMarket?.bars ?? []),
    ...(json.afterMarket?.bars ?? []),
  ];
  const points = bars
    .map(parseBar)
    .filter((p): p is PublicBarPoint => Boolean(p));
  return points.length > 0 ? points : null;
}

function parseBar(bar: PublicRawBar): PublicBarPoint | null {
  const time = bar.timestamp ? new Date(bar.timestamp).getTime() : NaN;
  const close = Number(bar.close);
  const high = Number(bar.high);
  const low = Number(bar.low);
  if (![time, close, high, low].every(Number.isFinite)) return null;
  return { time, close, high, low };
}

async function postPublicAccountMarketData(
  accountId: string,
  resource: string,
  body: unknown,
): Promise<unknown | null> {
  const token = process.env.PUBLIC_API_KEY?.trim();
  if (!token) return null;
  const res = await fetch(
    `${PUBLIC_API_BASE}/userapigateway/marketdata/${encodeURIComponent(accountId)}/${resource}`,
    {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "fintheon-public-market-data",
      },
      body: JSON.stringify(body),
    },
  );
  return res.ok ? res.json() : null;
}
