// [claude-code 2026-04-14] ORB price service — Opening Range Breakout direction via Yahoo intraday bars

import { getIntradayBars } from "./yahoo-market.js";
import type { ORBResult } from "./cot-types.js";

export const futuresSymbolMap: Record<string, string> = {
  "/NQ": "NQ=F",
  "/ES": "ES=F",
  "/MNQ": "MNQ=F",
  "/MES": "MES=F",
};

/**
 * Get ORB direction: compare the bar at startTimeET with the bar 10 minutes later.
 * @param instrument - Futures instrument (e.g. "/NQ")
 * @param startTimeET - Regime start time in HH:MM ET format
 */
export async function getORBDirection(
  instrument: string,
  startTimeET: string,
): Promise<ORBResult> {
  const yahooSymbol = futuresSymbolMap[instrument] ?? instrument;
  const bars = await getIntradayBars(yahooSymbol, "1d", "1m");

  if (bars.length === 0) {
    throw new Error(`No intraday bars for ${yahooSymbol}`);
  }

  // Parse startTimeET into today's ET timestamp
  const [startH, startM] = startTimeET.split(":").map(Number);
  const nowET = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const startTarget = new Date(nowET);
  startTarget.setHours(startH, startM, 0, 0);
  const startMs = startTarget.getTime();
  const tenMinLater = startMs + 10 * 60 * 1000;

  // Find nearest bars
  const openBar = findNearestBar(bars, startMs);
  const laterBar = findNearestBar(bars, tenMinLater);

  const openPrice = openBar.close;
  const price10Min = laterBar.close;
  const changeBps = Math.round(((price10Min - openPrice) / openPrice) * 10000);
  const changePercent = Number(
    (((price10Min - openPrice) / openPrice) * 100).toFixed(4),
  );

  return {
    instrument,
    openPrice,
    price10Min,
    direction: price10Min >= openPrice ? "bullish" : "bearish",
    changeBps: Math.abs(changeBps),
    changePercent: Math.abs(changePercent),
    timestamp: new Date().toISOString(),
  };
}

function findNearestBar(
  bars: Array<{ timestamp: number; close: number }>,
  targetMs: number,
): { timestamp: number; close: number } {
  let closest = bars[0];
  let closestDiff = Math.abs(bars[0].timestamp - targetMs);
  for (const bar of bars) {
    const diff = Math.abs(bar.timestamp - targetMs);
    if (diff < closestDiff) {
      closest = bar;
      closestDiff = diff;
    }
  }
  return closest;
}
