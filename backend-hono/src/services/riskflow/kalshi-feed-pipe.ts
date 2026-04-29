// [claude-code 2026-04-28] S48-T2: Kalshi WhaleAlert → RiskFlow feed pipe.
// Maps Econ & Politics whale alerts into CollectedNewsItem format for the
// riskflow-worker Standard tier. Excludes weather/crypto/meme categories.
import { createHash } from "node:crypto";
import { createKalshiService } from "../kalshi-service.js";
import type { WhaleAlert } from "../../types/kalshi.js";
import type { CollectedNewsItem } from "../../workers/riskflow-worker/sources/types.js";

function makeItemId(id: string): string {
  return createHash("sha1")
    .update(`kalshi-whale:${id}`)
    .digest("hex")
    .slice(0, 24);
}

function alertToFeedItem(alert: WhaleAlert): CollectedNewsItem {
  const notionalStr =
    alert.notionalUsd >= 1000
      ? `$${(alert.notionalUsd / 1000).toFixed(1)}K`
      : `$${alert.notionalUsd.toFixed(0)}`;

  const side = alert.takerSide === "yes" ? "BULLISH" : "BEARISH";
  const headline = `${alert.marketTitle} | Whale: ${alert.contracts} contracts / ${notionalStr} | ${side} (${(alert.lastPrice * 100).toFixed(0)}c)`;

  const body = [
    `Market: ${alert.marketTitle}`,
    `Ticker: ${alert.ticker}`,
    `Side: ${alert.takerSide.toUpperCase()}`,
    `Contracts: ${alert.contracts}`,
    `Notional: $${alert.notionalUsd.toFixed(2)}`,
    `Last Price: ${alert.lastPrice.toFixed(4)} (${(alert.lastPrice * 100).toFixed(0)}c)`,
    `Category: ${alert.category}`,
    `Alert Types: ${alert.alertTypes.join(", ")}`,
    alert.openInterest != null ? `Open Interest: ${alert.openInterest}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    item_id: makeItemId(alert.id),
    source: "kalshi",
    source_domain: "kalshi.com",
    headline,
    body,
    url: `https://kalshi.com/markets/${alert.ticker}`,
    tier: "standard",
    published_at: alert.createdAt,
    fetched_at: alert.detectedAt,
    fetch_latency_ms: 0,
  };
}

export async function pollKalshiWhaleAlerts(): Promise<CollectedNewsItem[]> {
  const svc = createKalshiService();
  if (!svc.isConfigured()) return [];

  try {
    const { alerts } = await svc.getEconPoliticsWhaleAlerts();
    if (!alerts || alerts.length === 0) return [];

    const fresh = alerts.filter((a) => {
      if (!a.detectedAt) return true;
      const age = Date.now() - new Date(a.detectedAt).getTime();
      return age < 10 * 60 * 1000; // last 10 minutes
    });

    return fresh.map(alertToFeedItem);
  } catch (err) {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "kalshi_poll_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return [];
  }
}
