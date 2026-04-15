// [claude-code 2026-04-14] COT data service — CFTC weekly positioning reports
// Fetches disaggregated futures data from CFTC Socrata API, caches 24h

import type { COTData } from "./cot-types.js";

const CFTC_URL = "https://publicreporting.cftc.gov/resource/jun7-fc8e.json";

// CME contract codes for major futures
const CONTRACT_CODES: Record<string, string> = {
  "/ES": "13874A",
  "/NQ": "209742",
  "/MNQ": "209742", // micro shares the same COT report as full-size
  "/MES": "13874A",
};

interface CacheEntry {
  data: COTData;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const NEUTRAL_FALLBACK = (instrument: string): COTData => ({
  instrument,
  reportDate: "",
  commercialNet: 0,
  nonCommercialNet: 0,
  managedMoneyNet: 0,
  weekOverWeekChange: 0,
  signal: "neutral",
  signalStrength: 0.5,
  fetchedAt: new Date().toISOString(),
});

function deriveSignal(strength: number): "bullish" | "bearish" | "neutral" {
  if (strength > 0.6) return "bullish";
  if (strength < 0.4) return "bearish";
  return "neutral";
}

export async function getCOTPositioning(instrument: string): Promise<COTData> {
  const contractCode = CONTRACT_CODES[instrument];
  if (!contractCode) return NEUTRAL_FALLBACK(instrument);

  // Check cache
  const cached = cache.get(instrument);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  try {
    const params = new URLSearchParams({
      cftc_contract_market_code: contractCode,
      $order: "report_date_as_yyyy_mm_dd DESC",
      $limit: "52",
    });

    const res = await fetch(`${CFTC_URL}?${params}`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });

    if (!res.ok) throw new Error(`CFTC HTTP ${res.status}`);
    const rows: any[] = await res.json();
    if (!rows.length) throw new Error("No COT data returned");

    // Parse managed money net for each week
    const parsed = rows.map((r) => {
      const mmLong = Number(r.m_money_positions_long_all ?? 0);
      const mmShort = Number(r.m_money_positions_short_all ?? 0);
      return {
        date: r.report_date_as_yyyy_mm_dd as string,
        mmNet: mmLong - mmShort,
        commLong: Number(r.comm_positions_long_all ?? 0),
        commShort: Number(r.comm_positions_short_all ?? 0),
        ncLong: Number(r.noncomm_positions_long_all ?? 0),
        ncShort: Number(r.noncomm_positions_short_all ?? 0),
      };
    });

    const latest = parsed[0];
    const commercialNet = latest.commLong - latest.commShort;
    const nonCommercialNet = latest.ncLong - latest.ncShort;
    const managedMoneyNet = latest.mmNet;

    // Week-over-week change
    const prev = parsed.length > 1 ? parsed[1].mmNet : managedMoneyNet;
    const weekOverWeekChange = managedMoneyNet - prev;

    // Normalize managed money net against 52-week range for signal strength
    const mmNets = parsed.map((p) => p.mmNet);
    const min = Math.min(...mmNets);
    const max = Math.max(...mmNets);
    const range = max - min;
    const signalStrength = range > 0 ? (managedMoneyNet - min) / range : 0.5;

    const data: COTData = {
      instrument,
      reportDate: latest.date,
      commercialNet,
      nonCommercialNet,
      managedMoneyNet,
      weekOverWeekChange,
      signal: deriveSignal(signalStrength),
      signalStrength: Number(signalStrength.toFixed(3)),
      fetchedAt: new Date().toISOString(),
    };

    cache.set(instrument, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  } catch (err) {
    console.error("[COT] fetch failed:", err);
    // Return last cached value if available, otherwise neutral
    if (cached) return cached.data;
    return NEUTRAL_FALLBACK(instrument);
  }
}
