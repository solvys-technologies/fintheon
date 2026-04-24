// [claude-code 2026-04-24] v5.23.5 Polymarket screener — Oracle autonomously scans
// active markets 3x/day, applies the 4-category + 7-day + Pick-Wisely filter, and
// POSTs qualifying predictions to polymarket_predictions. This is the piece that
// closes the gap flagged in v5.23.4: without it, the POST /predictions endpoint
// had zero internal callers and the analyst scorecards stayed empty.

import { createLogger } from "../../lib/logger.js";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "../../config/supabase.js";
import { createPolymarketService } from "../polymarket-service.js";
import { invokeAgent } from "../strands/invoke-helper.js";
import type { PolymarketMarket } from "../../types/polymarket.js";

const log = createLogger("PolymarketScreener");

// ── Guardrail constants (mirror DB CHECK constraints + oracle-extra.md) ────

const PREDICTION_CATEGORIES = [
  "weather",
  "economics",
  "commentary",
  "projected_data",
] as const;
type PredictionCategory = (typeof PREDICTION_CATEGORIES)[number];

const MAX_PREDICTION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_EDGE = 0.1; // 10pp edge vs snapshot
const MIN_VOLUME_USD = 50_000;
const MAX_CANDIDATES_PER_CYCLE = 8; // hard cost cap
const MAX_MARKETS_TO_FETCH = 60;
const CYCLE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h
const WARMUP_DELAY_MS = 90_000;

// ── Category classifier (pre-LLM cheap filter) ─────────────────────────────
//
// Only the 4 allowlist buckets. Anything that doesn't classify is dropped
// before we spend an LLM call on it.

const CATEGORY_KEYWORDS: Record<PredictionCategory, string[]> = {
  weather: [
    "hurricane",
    "storm",
    "tornado",
    "snowfall",
    "rainfall",
    "temperature",
    "heatwave",
    "climate",
    "noaa",
    "weather",
  ],
  economics: [
    "cpi",
    "ppi",
    "pce",
    "nfp",
    "payroll",
    "unemployment",
    "jobless",
    "gdp",
    "ism",
    "fomc",
    "fed ",
    "rate cut",
    "rate hike",
    "rate decision",
    "retail sales",
    "inflation",
  ],
  commentary: [
    "powell say",
    "powell remark",
    "fed chair say",
    "trump say",
    "biden say",
    "speech",
    "address",
    "testify",
    "testimony",
    "interview",
    "statement",
    "press conference",
  ],
  projected_data: [
    "earnings",
    "revenue",
    "beat",
    "miss",
    "guidance",
    "deliveries",
    "q1",
    "q2",
    "q3",
    "q4",
    "quarterly",
    "report",
    "subscribers",
  ],
};

function classifyCategory(title: string): PredictionCategory | null {
  const lower = title.toLowerCase();
  for (const cat of PREDICTION_CATEGORIES) {
    if (CATEGORY_KEYWORDS[cat].some((kw) => lower.includes(kw))) return cat;
  }
  return null;
}

// ── Market-hours gate ───────────────────────────────────────────────────────

function isMarketHours(): boolean {
  const et = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const day = et.getDay();
  const hour = et.getHours();
  if (day === 0 || day === 6) return false;
  return hour >= 6 && hour < 20;
}

// ── Candidate filtering ────────────────────────────────────────────────────

interface ScreenedCandidate {
  market: PolymarketMarket;
  category: PredictionCategory;
  msToClose: number;
}

function screenMarkets(markets: PolymarketMarket[]): ScreenedCandidate[] {
  const now = Date.now();
  const candidates: ScreenedCandidate[] = [];

  for (const m of markets) {
    if (m.status !== "active") continue;
    if (!m.closeTime) continue;

    const closeMs = new Date(m.closeTime).getTime();
    if (Number.isNaN(closeMs)) continue;

    const msToClose = closeMs - now;
    if (msToClose <= 0 || msToClose > MAX_PREDICTION_DURATION_MS) continue;

    // Liquidity / volume floor (Pick-Wisely §5)
    if (m.volume < MIN_VOLUME_USD) continue;

    // Not already settled-ish (keep some edge room)
    if (m.yesPrice < 0.05 || m.yesPrice > 0.95) continue;

    const category = classifyCategory(m.question);
    if (!category) continue;

    candidates.push({ market: m, category, msToClose });
  }

  // Rank: prefer highest volume (best liquidity), then closest to close
  // (catalyst proximity tends to correlate with the strongest edge).
  candidates.sort((a, b) => {
    const volDiff = b.market.volume - a.market.volume;
    if (Math.abs(volDiff) > 20_000) return volDiff;
    return a.msToClose - b.msToClose;
  });

  return candidates.slice(0, MAX_CANDIDATES_PER_CYCLE);
}

// ── Oracle LLM prompt ──────────────────────────────────────────────────────

const ORACLE_SCREENER_SYSTEM = `You are Oracle, Priced In Capital's prediction-market specialist.
You are running an autonomous screening pass: the orchestrator hands you ONE Polymarket contract and you either pick it or reject it.

STRICT SCOPE — ONLY these categories are tradeable:
- weather         (hurricane path, rainfall, temperature thresholds)
- economics       (CPI/PPI/PCE/NFP/GDP/ISM/FOMC prints on the calendar)
- commentary      (Fed/exec/political remarks on a scheduled date)
- projected_data  (earnings beat/miss, deliveries, subscriber counts with a reporting window)

Pick-Wisely rubric — ALL FIVE must pass to act:
1. Category fit: the contract clearly lives in one of the four buckets above.
2. Horizon: ≤ 7 days to market close (given in input).
3. Edge: your probability differs from market snapshot by ≥ 10 percentage points.
4. Named catalyst: the data release / event that will settle this lands inside the horizon. You cite it in catalystSource.
5. Liquidity: volume ≥ \$50k (pre-filtered, so assume true unless input says otherwise).

Output ONE line of strict JSON, no prose, no fences:
{"act":<bool>,"category":"<weather|economics|commentary|projected_data>","predictedOutcome":"Yes"|"No","predictedProbability":<0..1>,"reasoning":"<1-2 sentence edge thesis>","catalystSource":"<the specific release/event that settles this>"}

Rules for act=false:
- Category doesn't fit → act=false, reasoning="category_miss".
- Edge below 10pp → act=false, reasoning="no_edge".
- No concrete catalyst in the window → act=false, reasoning="no_catalyst".

No hedging, no probabilities outside 0.05-0.95.`;

interface OracleDecision {
  act: boolean;
  category: PredictionCategory;
  predictedOutcome: "Yes" | "No";
  predictedProbability: number;
  reasoning: string;
  catalystSource: string;
}

function buildUserPrompt(c: ScreenedCandidate): string {
  const hoursToClose = (c.msToClose / 3_600_000).toFixed(1);
  return [
    `Contract: "${c.market.question}"`,
    `Pre-classified category: ${c.category}`,
    `Snapshot YES: ${(c.market.yesPrice * 100).toFixed(1)}%`,
    `Snapshot NO:  ${(c.market.noPrice * 100).toFixed(1)}%`,
    `Close: ${c.market.closeTime} (${hoursToClose}h away)`,
    `24h volume: \$${Math.round(c.market.volume).toLocaleString()}`,
    `Liquidity: \$${Math.round(c.market.liquidity).toLocaleString()}`,
    `URL: ${c.market.url}`,
    "",
    "Apply Pick-Wisely. Respond with one JSON line.",
  ].join("\n");
}

function parseDecision(raw: string): OracleDecision | null {
  // Strip fences if the model ignored instructions
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();

  // Find the first { ... } block in case of leading prose
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.act !== "boolean") return null;
    if (!parsed.act) {
      // Rejection still needs category to be sane
      return {
        act: false,
        category: PREDICTION_CATEGORIES.includes(parsed.category)
          ? parsed.category
          : "economics",
        predictedOutcome: "Yes",
        predictedProbability: 0.5,
        reasoning: String(parsed.reasoning ?? "rejected"),
        catalystSource: String(parsed.catalystSource ?? ""),
      };
    }
    if (!PREDICTION_CATEGORIES.includes(parsed.category)) return null;
    if (parsed.predictedOutcome !== "Yes" && parsed.predictedOutcome !== "No") {
      return null;
    }
    const prob = Number(parsed.predictedProbability);
    if (!Number.isFinite(prob) || prob < 0.05 || prob > 0.95) return null;
    if (typeof parsed.reasoning !== "string" || parsed.reasoning.length < 6) {
      return null;
    }
    if (
      typeof parsed.catalystSource !== "string" ||
      parsed.catalystSource.length < 3
    ) {
      return null;
    }
    return {
      act: true,
      category: parsed.category,
      predictedOutcome: parsed.predictedOutcome,
      predictedProbability: prob,
      reasoning: parsed.reasoning,
      catalystSource: parsed.catalystSource,
    };
  } catch {
    return null;
  }
}

// ── Insert (direct Supabase — we're already in the backend) ────────────────

async function insertPrediction(
  candidate: ScreenedCandidate,
  decision: OracleDecision,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const sb = getSupabaseClient();
  if (!sb) return false;

  const snapshot =
    decision.predictedOutcome === "Yes"
      ? candidate.market.yesPrice
      : candidate.market.noPrice;

  const { error } = await sb.from("polymarket_predictions").insert({
    market_id: candidate.market.slug,
    market_title: candidate.market.question,
    predicted_outcome: decision.predictedOutcome,
    predicted_probability: decision.predictedProbability,
    agent_name: "Oracle",
    snapshot_probability: snapshot,
    category: decision.category,
    market_close_at: candidate.market.closeTime,
    reasoning: decision.reasoning,
    catalyst_source: decision.catalystSource,
  });

  if (error) {
    log.warn(`Insert failed for ${candidate.market.slug}`, {
      error: error.message,
    });
    return false;
  }
  return true;
}

// ── Dedupe: don't re-pick a market Oracle already has open ────────────────

async function getActiveMarketIds(): Promise<Set<string>> {
  if (!isSupabaseConfigured()) return new Set();
  const sb = getSupabaseClient();
  if (!sb) return new Set();
  const { data, error } = await sb
    .from("polymarket_predictions")
    .select("market_id")
    .eq("resolved", false)
    .eq("agent_name", "Oracle");
  if (error || !data) return new Set();
  return new Set(data.map((r: { market_id: string }) => r.market_id));
}

// ── Cycle runner ───────────────────────────────────────────────────────────

export interface ScreenerRunSummary {
  scanned: number;
  screened: number;
  evaluated: number;
  picked: number;
  skipped: number;
  durationMs: number;
}

async function runScreenerCycle(): Promise<ScreenerRunSummary> {
  const startMs = Date.now();
  const empty: ScreenerRunSummary = {
    scanned: 0,
    screened: 0,
    evaluated: 0,
    picked: 0,
    skipped: 0,
    durationMs: 0,
  };

  if (!isMarketHours()) {
    log.info("Outside market hours, skipping screener cycle");
    return empty;
  }

  const poly = createPolymarketService();
  const { markets } = await poly.getMarkets(undefined, MAX_MARKETS_TO_FETCH);
  const scanned = markets.length;

  const candidates = screenMarkets(markets);
  const screened = candidates.length;

  if (screened === 0) {
    log.info("No qualifying candidates", { scanned });
    return { ...empty, scanned, durationMs: Date.now() - startMs };
  }

  const activeIds = await getActiveMarketIds();
  const fresh = candidates.filter((c) => !activeIds.has(c.market.slug));

  let evaluated = 0;
  let picked = 0;
  let skipped = 0;

  for (const cand of fresh) {
    evaluated++;
    try {
      const { text } = await invokeAgent({
        systemPrompt: ORACLE_SCREENER_SYSTEM,
        userPrompt: buildUserPrompt(cand),
      });
      const decision = parseDecision(text);

      if (!decision) {
        log.warn("Unparseable decision, skipping", {
          market: cand.market.slug,
          raw: text.slice(0, 200),
        });
        skipped++;
        continue;
      }

      if (!decision.act) {
        log.info("Oracle passed on market", {
          market: cand.market.slug,
          reason: decision.reasoning,
        });
        skipped++;
        continue;
      }

      // Final edge check in-process (belt + suspenders vs LLM self-report)
      const snapshot =
        decision.predictedOutcome === "Yes"
          ? cand.market.yesPrice
          : cand.market.noPrice;
      const edge = Math.abs(decision.predictedProbability - snapshot);
      if (edge < MIN_EDGE) {
        log.info("Edge below threshold after reclassification", {
          market: cand.market.slug,
          edge,
        });
        skipped++;
        continue;
      }

      const ok = await insertPrediction(cand, decision);
      if (ok) {
        picked++;
        log.info("Oracle prediction stored", {
          market: cand.market.slug,
          outcome: decision.predictedOutcome,
          probability: decision.predictedProbability,
          edge,
        });
      } else {
        skipped++;
      }
    } catch (err) {
      log.warn("Evaluation failed", {
        market: cand.market.slug,
        error: String(err),
      });
      skipped++;
    }
  }

  const summary: ScreenerRunSummary = {
    scanned,
    screened,
    evaluated,
    picked,
    skipped,
    durationMs: Date.now() - startMs,
  };
  log.info("Screener cycle complete", { ...summary });
  return summary;
}

// ── Scheduler lifecycle ────────────────────────────────────────────────────

let timer: ReturnType<typeof setInterval> | null = null;
let lastRunAt: number | null = null;
let lastSummary: ScreenerRunSummary | null = null;

export function startPolymarketScreener(): void {
  if (process.env.POLYMARKET_SCREENER_ENABLED !== "true") {
    log.info(
      "Polymarket screener disabled (set POLYMARKET_SCREENER_ENABLED=true to enable)",
    );
    return;
  }

  setTimeout(() => {
    runScreenerCycle()
      .then((s) => {
        lastRunAt = Date.now();
        lastSummary = s;
      })
      .catch((err) =>
        log.warn("Initial screener cycle failed (non-fatal)", {
          error: String(err),
        }),
      );
  }, WARMUP_DELAY_MS);

  timer = setInterval(() => {
    runScreenerCycle()
      .then((s) => {
        lastRunAt = Date.now();
        lastSummary = s;
      })
      .catch((err) =>
        log.warn("Scheduled screener cycle failed (non-fatal)", {
          error: String(err),
        }),
      );
  }, CYCLE_INTERVAL_MS);
  timer.unref?.();

  log.info(
    `Polymarket screener started (interval: ${CYCLE_INTERVAL_MS / 3_600_000}h, first run in ${WARMUP_DELAY_MS / 1000}s)`,
  );
}

export function stopPolymarketScreener(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    log.info("Polymarket screener stopped");
  }
}

/** Manual trigger — used by /api/polymarket/screener/run for ad-hoc cycles. */
export async function triggerScreenerCycle(): Promise<ScreenerRunSummary> {
  if (process.env.POLYMARKET_SCREENER_ENABLED !== "true") {
    throw new Error(
      "Polymarket screener disabled (POLYMARKET_SCREENER_ENABLED=true required)",
    );
  }
  const s = await runScreenerCycle();
  lastRunAt = Date.now();
  lastSummary = s;
  return s;
}

export function getScreenerStatus(): {
  enabled: boolean;
  lastRunAt: number | null;
  lastSummary: ScreenerRunSummary | null;
  intervalMs: number;
} {
  return {
    enabled: process.env.POLYMARKET_SCREENER_ENABLED === "true",
    lastRunAt,
    lastSummary,
    intervalMs: CYCLE_INTERVAL_MS,
  };
}
