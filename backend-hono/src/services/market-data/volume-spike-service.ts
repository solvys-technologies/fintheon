// [claude-code 2026-04-14] Volume spike detection — compares current session volume to 5-day average

import { getIntradayBars } from "./yahoo-market.js";
import { futuresSymbolMap } from "./orb-price-service.js";

interface VolumeSpikeResult {
  signal: number; // 0-1
  currentVolume: number;
  avgVolume: number;
}

const NEUTRAL_FALLBACK: VolumeSpikeResult = {
  signal: 0.3,
  currentVolume: 0,
  avgVolume: 0,
};

/**
 * Detect volume spikes by comparing today's volume in a time window
 * against the 5-day average for the same window.
 * Signal: min(1, currentVolume / (avgVolume * 2)) — 2x average = 1.0
 */
export async function getVolumeSpikeSignal(
  instrument: string,
  startTime: string,
  endTime: string,
): Promise<VolumeSpikeResult> {
  try {
    const yahooSymbol = futuresSymbolMap[instrument] ?? instrument;

    // Fetch 5d of 1m bars — Yahoo returns volume in the quote indicators
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=5d&interval=1m`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error(`No data for ${yahooSymbol}`);

    const timestamps: number[] = result.timestamp ?? [];
    const volumes: number[] = result.indicators?.quote?.[0]?.volume ?? [];

    if (timestamps.length === 0) return NEUTRAL_FALLBACK;

    // Parse start/end times
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;

    // Group bars by day, filter to time window
    const dayBuckets = new Map<string, number[]>();
    for (let i = 0; i < timestamps.length; i++) {
      if (volumes[i] == null) continue;
      const d = new Date(timestamps[i] * 1000);
      const et = new Date(
        d.toLocaleString("en-US", { timeZone: "America/New_York" }),
      );
      const mins = et.getHours() * 60 + et.getMinutes();
      if (mins < startMins || mins >= endMins) continue;

      const dayKey = et.toISOString().slice(0, 10);
      const bucket = dayBuckets.get(dayKey) ?? [];
      bucket.push(volumes[i]);
      dayBuckets.set(dayKey, bucket);
    }

    const days = [...dayBuckets.entries()].sort((a, b) =>
      b[0].localeCompare(a[0]),
    );
    if (days.length === 0) return NEUTRAL_FALLBACK;

    // Today = first entry, prior days = rest
    const todayVols = days[0][1];
    const currentVolume = todayVols.reduce((s, v) => s + v, 0);

    const priorDays = days.slice(1);
    if (priorDays.length === 0) {
      return { signal: 0.5, currentVolume, avgVolume: currentVolume };
    }

    const priorTotals = priorDays.map((d) => d[1].reduce((s, v) => s + v, 0));
    const avgVolume = Math.round(
      priorTotals.reduce((s, v) => s + v, 0) / priorTotals.length,
    );

    const signal =
      avgVolume > 0 ? Math.min(1, currentVolume / (avgVolume * 2)) : 0.5;

    return {
      signal: Number(signal.toFixed(3)),
      currentVolume,
      avgVolume,
    };
  } catch (err) {
    console.error("[VolSpike] error:", err);
    return NEUTRAL_FALLBACK;
  }
}
