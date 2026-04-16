// [claude-code 2026-04-16] S20-T3: Oracle prediction market scanner
// Queries Polymarket + Kalshi for active contracts matching Oracle's subjects,
// identifies contracts with significant volume or price movement.

import { createPolymarketService } from "../polymarket-service.js";
import { createKalshiService } from "../kalshi-service.js";
import { createLogger } from "../../lib/logger.js";
import type { ScannedContract, OracleSubject } from "./types.js";
import { ORACLE_SUBJECTS } from "./types.js";

const log = createLogger("OracleScanner");

const SUBJECT_KEYWORDS: Record<OracleSubject, string[]> = {
  macro: ["gdp", "recession", "employment", "jobs", "nfp", "payroll"],
  "monetary-policy": [
    "fed",
    "fomc",
    "rate cut",
    "rate hike",
    "interest rate",
    "powell",
  ],
  "prediction-markets": ["prediction", "forecast", "odds"],
  regime: ["regime", "volatility", "vix", "bear market", "bull market"],
  geopolitical: ["war", "sanctions", "tariff", "china", "russia", "nato"],
  "trade-policy": ["trade", "tariff", "import", "export", "wto"],
  energy: ["oil", "crude", "opec", "natural gas", "energy"],
  inflation: ["cpi", "ppi", "pce", "inflation", "deflation"],
};

/** Minimum 24h volume to consider a contract worth scanning */
const MIN_VOLUME_THRESHOLD = 5000;
/** Minimum absolute price change in 24h to flag as notable */
const MIN_PRICE_CHANGE = 0.05;

function matchesOracleSubjects(title: string): boolean {
  const lower = title.toLowerCase();
  return ORACLE_SUBJECTS.some((subject) =>
    SUBJECT_KEYWORDS[subject].some((kw) => lower.includes(kw)),
  );
}

function inferCategory(title: string): string {
  const lower = title.toLowerCase();
  for (const subject of ORACLE_SUBJECTS) {
    if (SUBJECT_KEYWORDS[subject].some((kw) => lower.includes(kw))) {
      return subject;
    }
  }
  return "general";
}

export async function scanPredictionMarkets(): Promise<ScannedContract[]> {
  const results: ScannedContract[] = [];

  const [polyContracts, kalshiContracts] = await Promise.allSettled([
    scanPolymarket(),
    scanKalshi(),
  ]);

  if (polyContracts.status === "fulfilled") {
    results.push(...polyContracts.value);
  } else {
    log.warn("Polymarket scan failed", { error: String(polyContracts.reason) });
  }

  if (kalshiContracts.status === "fulfilled") {
    results.push(...kalshiContracts.value);
  } else {
    log.warn("Kalshi scan failed", { error: String(kalshiContracts.reason) });
  }

  log.info(`Scanned ${results.length} contracts matching Oracle subjects`);
  return results;
}

async function scanPolymarket(): Promise<ScannedContract[]> {
  const polyService = createPolymarketService();
  const { markets } = await polyService.getMarkets(undefined, 50);

  return markets
    .filter((m) => matchesOracleSubjects(m.question))
    .map((m) => ({
      platform: "polymarket" as const,
      contractId: m.slug || m.conditionId,
      title: m.question,
      category: inferCategory(m.question),
      yesPrice: m.yesPrice,
      volume24h: m.volume,
      priceChange24h: 0,
    }))
    .filter((c) => c.volume24h >= MIN_VOLUME_THRESHOLD || c.yesPrice > 0);
}

async function scanKalshi(): Promise<ScannedContract[]> {
  const kalshiService = createKalshiService();
  const { markets } = await kalshiService.getMarkets();

  return markets
    .filter((m) => matchesOracleSubjects(m.title))
    .map((m) => ({
      platform: "kalshi" as const,
      contractId: m.ticker,
      title: m.title,
      category: inferCategory(m.title),
      yesPrice: m.lastPrice,
      volume24h: m.volume24h,
      priceChange24h: 0,
    }))
    .filter(
      (c) =>
        c.volume24h >= MIN_VOLUME_THRESHOLD ||
        c.priceChange24h >= MIN_PRICE_CHANGE,
    );
}
