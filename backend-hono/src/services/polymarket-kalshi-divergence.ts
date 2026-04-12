// [claude-code 2026-04-12] S15-T3: Cross-platform odds divergence detector

import { createPolymarketService } from "./polymarket-service.js";
import { createKalshiService } from "./kalshi-service.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("DivergenceDetector");
const DIVERGENCE_THRESHOLD = 0.1; // 10%
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 min

export interface DivergenceAlert {
  id: string;
  polymarketSlug: string;
  polymarketQuestion: string;
  polymarketYesPrice: number;
  kalshiTicker: string;
  kalshiTitle: string;
  kalshiYesPrice: number;
  divergencePct: number;
  direction: "poly_higher" | "poly_lower";
  detectedAt: string;
  significance: "moderate" | "high";
}

let recentAlerts: DivergenceAlert[] = [];

export function getRecentDivergenceAlerts(): DivergenceAlert[] {
  return recentAlerts;
}

async function checkDivergence(): Promise<void> {
  try {
    const polyService = createPolymarketService();
    const kalshiService = createKalshiService();

    const [polyData, kalshiData] = await Promise.all([
      polyService.getMarkets(undefined, 30),
      kalshiService.getMarkets(),
    ]);

    if (!polyData.markets.length || !kalshiData.markets.length) {
      log.warn("Missing data from one or both platforms");
      return;
    }

    const newAlerts: DivergenceAlert[] = [];

    for (const pm of polyData.markets) {
      const kalshiMatch = findBestMatch(pm.question, kalshiData.markets);
      if (!kalshiMatch) continue;

      const divergence = Math.abs(pm.yesPrice - kalshiMatch.lastPrice);
      if (divergence < DIVERGENCE_THRESHOLD) continue;

      newAlerts.push({
        id: `div-${pm.conditionId}-${Date.now()}`,
        polymarketSlug: pm.slug,
        polymarketQuestion: pm.question,
        polymarketYesPrice: pm.yesPrice,
        kalshiTicker: kalshiMatch.ticker,
        kalshiTitle: kalshiMatch.title,
        kalshiYesPrice: kalshiMatch.lastPrice,
        divergencePct: Math.round(divergence * 100),
        direction:
          pm.yesPrice > kalshiMatch.lastPrice ? "poly_higher" : "poly_lower",
        detectedAt: new Date().toISOString(),
        significance: divergence > 0.15 ? "high" : "moderate",
      });
    }

    if (newAlerts.length > 0) {
      log.info(`Found ${newAlerts.length} divergence alerts`, {
        alerts: newAlerts.map(
          (a) => `${a.polymarketQuestion}: ${a.divergencePct}%`,
        ),
      });
    }

    recentAlerts = newAlerts;
  } catch (err) {
    log.error("Divergence check failed", { error: String(err) });
  }
}

function findBestMatch(
  polyQuestion: string,
  kalshiMarkets: Array<{ ticker: string; title: string; lastPrice: number }>,
): { ticker: string; title: string; lastPrice: number } | null {
  const polyLower = polyQuestion.toLowerCase();
  const keyTerms = polyLower
    .replace(/will |the |be |by |in |to |of |a |an /g, "")
    .split(/\s+/)
    .filter((t) => t.length > 3);

  let best: (typeof kalshiMarkets)[0] | null = null;
  let bestScore = 0;

  for (const km of kalshiMarkets) {
    const title = km.title.toLowerCase();
    let score = 0;
    for (const term of keyTerms) {
      if (title.includes(term)) score++;
    }
    if (score >= 3 && score > bestScore) {
      bestScore = score;
      best = km;
    }
  }

  return best;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startDivergenceDetector(): void {
  log.info("Starting divergence detector (15min interval)");
  setTimeout(() => checkDivergence(), 30_000);
  intervalId = setInterval(checkDivergence, CHECK_INTERVAL_MS);
}

export function stopDivergenceDetector(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
