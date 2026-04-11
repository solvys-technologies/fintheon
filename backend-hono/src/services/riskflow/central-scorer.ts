// [claude-code 2026-03-31] POI priority boost — Top 3 POI = Critical (macroLevel 4), Top 8 = High (macroLevel 3)
// [claude-code 2026-03-26] Fix currentPrice: 0 → fetch real instrument price for autoresearch observations
// [claude-code 2026-03-24] Added reactive MiroShark adjustment loop for high-impact items (macroLevel >= 3)
// [claude-code 2026-03-23] Central scoring agent — polls unscored items from Supabase, runs AI analysis, writes scored results
// Gated by ENABLE_CENTRAL_SCORING=true (only TP's instance should set this)
// Phase T4: wired recordObservation() to feed autoresearch scoring pipeline
import { enrichFeedWithAnalysis } from "./feed-service.js";
import {
  DEFAULT_COMMENTATORS,
  type CommentatorEntry,
} from "../../types/commentator.js";
import {
  readUnscoredItems,
  readScoredItems,
  writeScoredItems,
  writeConsiliumMessage,
  type RawRiskFlowItem,
  type ScoredRiskFlowItem,
} from "../supabase-service.js";
import { isSupabaseConfigured } from "../../config/supabase.js";
import type { FeedItem } from "../../types/riskflow.js";
import { createLogger } from "../../lib/logger.js";
import { recordObservation } from "../autoresearch/scoring-observer.js";
import { resolvePriceAt } from "../autoresearch/price-resolver.js";
import { getInstrumentConfig } from "../iv-scoring-v2.js";
import { fetchVIX } from "../vix-service.js";
import {
  shouldTriggerReactiveAdjustment,
  adjustScoresForRiskFlow,
  getRunningState,
  setRunningState,
} from "../miroshark/miroshark-reactive.js";
import {
  getAllActivePhrases,
  phraseMatchesItem,
  recordMatch,
} from "./watchlist-phrases-service.js";
import {
  generateNotesForCriticalItems,
  generateNotesForEconItems,
} from "./agent-notes.js";
import { tagHeadlineSubjects } from "./headline-tagger.js";

const log = createLogger("CentralScorer");

// ── Source Normalization ─────────────────────────────────────────────────────
// S10-T1a: Normalize raw source labels to the 4 watchlist categories so items
// pass the watchlist source filter. Without this, 99% of items are invisible.

/** Twitter/RSS accounts that map to FinancialJuice (financial news wires) */
const FJ_ACCOUNTS = new Set([
  "financialjuice",
  "firstsquawk",
  "wallstjesus",
  "unusual_whales",
  "newsfilterio",
  "marketcurrents",
  "livesquawk",
  "waboratory",
]);

/** Accounts that map to DeItaOne (Walter Bloomberg breaking wires) */
const DEITAONE_ACCOUNTS = new Set(["deltaone", "deItaone", "deitaone"]);

/** OSINT / geopolitical intelligence accounts → OSINTSources */
const OSINT_ACCOUNTS = new Set([
  "osintdefender",
  "intikinetik",
  "thespectatorindex",
  "schizointel",
  "menchosint",
  "clashreport",
  // Key POIs — official/government accounts with market-moving weight
  "aboragchi", // Abbas Araghchi — Iran FM
  "israelipm", // Israeli PM Office
  "secdef", // US Secretary of Defense
  "ustreasury", // US Treasury
  "whitehouse", // White House
  "vp", // Vice President
  "ecb", // European Central Bank
]);

/** Keywords that indicate economic calendar / data releases */
const ECON_KEYWORDS = [
  "cpi",
  "ppi",
  "nfp",
  "gdp",
  "pce",
  "fomc",
  "fed rate",
  "jobless claims",
  "retail sales",
  "housing starts",
  "consumer confidence",
  "ism ",
  "adp ",
  "unemployment",
  "inflation",
  "payrolls",
  "economic calendar",
  "data release",
];

/** Keywords that indicate geopolitical / insider wire content */
const GEO_KEYWORDS = [
  "tariff",
  "sanction",
  "military",
  "invasion",
  "war ",
  "conflict",
  "nato",
  "opec",
  "missile",
  "nuclear",
  "geopolitical",
  "executive order",
  "white house",
  "congress",
  "legislation",
  "treasury secretary",
];

/** Keywords that indicate prediction market content */
const PREDICTION_KEYWORDS = [
  "polymarket",
  "kalshi",
  "prediction market",
  "betting odds",
  "probability",
];

/**
 * Normalize a raw source label + content into one of the 4 watchlist categories.
 * Priority: account-based → content-based → fallback to FinancialJuice.
 */
export function normalizeSource(
  rawSource: string | undefined,
  headline: string,
  tags: string[] = [],
): "FinancialJuice" | "OSINTSources" | "EconomicCalendar" | "Polymarket" {
  const src = (rawSource || "").toLowerCase().replace(/[^a-z0-9_]/g, "");

  // Direct match: already a watchlist category
  if (rawSource === "FinancialJuice") return "FinancialJuice";
  if (rawSource === "OSINTSources") return "OSINTSources";
  if (rawSource === "DeItaOne") return "FinancialJuice"; // Wire service → financial news
  if (rawSource === "EconomicCalendar") return "EconomicCalendar";
  if (rawSource === "Polymarket" || rawSource === "Kalshi") return "Polymarket";

  // Account-based mapping
  if (FJ_ACCOUNTS.has(src)) return "FinancialJuice";
  if (DEITAONE_ACCOUNTS.has(src)) return "FinancialJuice"; // Walter Bloomberg → financial news
  if (OSINT_ACCOUNTS.has(src)) return "OSINTSources";

  // Content-based classification
  const text = (headline + " " + tags.join(" ")).toLowerCase();

  if (PREDICTION_KEYWORDS.some((kw) => text.includes(kw))) return "Polymarket";
  if (ECON_KEYWORDS.some((kw) => text.includes(kw))) return "EconomicCalendar";
  if (GEO_KEYWORDS.some((kw) => text.includes(kw))) return "OSINTSources";

  // Default: financial news
  return "FinancialJuice";
}

// ── Risk Type Classification ─────────────────────────────────────────────────

const RISK_TYPE_KEYWORDS: Record<string, string[]> = {
  Macro: [
    "fed",
    "fomc",
    "cpi",
    "ppi",
    "gdp",
    "nfp",
    "pce",
    "rate",
    "inflation",
    "unemployment",
    "jobless",
    "retail sales",
    "housing starts",
    "consumer confidence",
  ],
  Geopolitical: [
    "war",
    "tariff",
    "sanction",
    "military",
    "conflict",
    "opec",
    "nato",
    "invasion",
    "missile",
    "nuclear",
  ],
  Earnings: [
    "earnings",
    "eps",
    "revenue",
    "guidance",
    "beat",
    "miss",
    "quarterly",
    "fiscal",
  ],
  Technical: [
    "resistance",
    "support",
    "breakout",
    "volume",
    "rsi",
    "macd",
    "moving average",
    "fibonacci",
    "trend",
  ],
  Credit: [
    "credit spread",
    "high yield",
    "leverage",
    "margin",
    "default",
    "downgrade",
    "junk bond",
  ],
  Liquidity: [
    "repo",
    "funding",
    "liquidity",
    "bank run",
    "cash crunch",
    "reserve",
  ],
};

/** Classify a headline + tags into a risk category using keyword matching */
export function classifyRiskType(
  headline: string,
  tags: string[],
): FeedItem["riskType"] {
  const text = (headline + " " + tags.join(" ")).toLowerCase();
  let bestType: FeedItem["riskType"] = "Commentary";
  let bestCount = 0;

  for (const [riskType, keywords] of Object.entries(RISK_TYPE_KEYWORDS)) {
    let count = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestType = riskType as FeedItem["riskType"];
    }
  }

  return bestType;
}

// ── Person of Interest Priority Boost ────────────────────────────────────────
// Commentary is a PRIMARY market driver. Any headline mentioning a POI gets
// boosted: Top 3 (rank 1-3) → Critical (macroLevel 4), Top 8 (rank 4-8) → High (macroLevel 3).
// All remaining POI mentions → at least Medium (macroLevel 2).

/** Pre-built alias lookup: lowercase alias → commentator entry */
const POI_ALIAS_MAP = new Map<
  string,
  Omit<CommentatorEntry, "id" | "createdAt">
>();
for (const c of DEFAULT_COMMENTATORS) {
  if (!c.active) continue;
  for (const alias of c.aliases) {
    POI_ALIAS_MAP.set(alias.toLowerCase(), c);
  }
  POI_ALIAS_MAP.set(c.name.toLowerCase(), c);
}

/**
 * Check if a headline mentions any Person of Interest.
 * Returns the highest-ranked (lowest rank number) POI found, or null.
 */
export function matchPersonOfInterest(
  headline: string,
): Omit<CommentatorEntry, "id" | "createdAt"> | null {
  const text = headline.toLowerCase();
  let bestMatch: Omit<CommentatorEntry, "id" | "createdAt"> | null = null;

  for (const [alias, entry] of POI_ALIAS_MAP) {
    if (text.includes(alias)) {
      if (!bestMatch || entry.rank < bestMatch.rank) {
        bestMatch = entry;
      }
    }
  }

  return bestMatch;
}

/**
 * Apply POI priority boost to a FeedItem's macroLevel.
 * Top 3 (rank 1-3) → macroLevel 4 (Critical)
 * Top 8 (rank 4-8) → macroLevel 3 (High)
 * Any other POI    → macroLevel 2 (Medium) minimum floor
 * Returns the matched POI name or null.
 */
export function applyPOIBoost(item: FeedItem): string | null {
  const poi = matchPersonOfInterest(item.headline);
  if (!poi) return null;

  const currentLevel = item.macroLevel ?? 1;

  if (poi.rank <= 3) {
    // Top 3: Powell, Trump, Bessent → always Critical
    item.macroLevel = 4;
  } else if (poi.rank <= 8) {
    // Top 8: Rubio, Lutnick, Witkoff, Greer, Navarro → at least High
    item.macroLevel = Math.max(currentLevel, 3) as FeedItem["macroLevel"];
  } else {
    // Any other POI → at least Medium
    item.macroLevel = Math.max(currentLevel, 2) as FeedItem["macroLevel"];
  }

  // Tag the item for traceability
  if (!item.tags) item.tags = [];
  if (!item.tags.includes("POI")) item.tags.push("POI");

  return poi.name;
}

const SCORING_INTERVAL = 30_000; // 30 seconds
const BATCH_SIZE = 20;
const ENABLE_CENTRAL_SCORING = process.env.ENABLE_CENTRAL_SCORING === "true";

let scoringTimer: ReturnType<typeof setInterval> | null = null;
let isScoring = false;

/**
 * Convert a raw Supabase item into a FeedItem for the existing enrichment pipeline
 */
function rawToFeedItem(raw: RawRiskFlowItem & { id: string }): FeedItem {
  return {
    id: raw.tweet_id,
    source: normalizeSource(raw.source, raw.headline || "", raw.tags || []),
    headline: raw.headline || "",
    body: raw.body,
    url: raw.url,
    symbols: raw.symbols || [],
    tags: raw.tags || [],
    isBreaking: raw.is_breaking || false,
    urgency: (raw.urgency as FeedItem["urgency"]) || "normal",
    publishedAt: raw.published_at || new Date().toISOString(),
  };
}

/**
 * Convert an enriched FeedItem back to a ScoredRiskFlowItem for Supabase
 */
function feedItemToScored(
  item: FeedItem,
  rawId: string | null,
): ScoredRiskFlowItem {
  return {
    raw_item_id: rawId ?? undefined,
    tweet_id: item.id,
    source: item.source,
    headline: item.headline,
    body: item.body,
    url: item.url,
    symbols: item.symbols,
    tags: item.tags,
    is_breaking: item.isBreaking,
    urgency: item.urgency,
    sentiment: item.sentiment,
    iv_score: item.ivScore,
    macro_level: item.macroLevel,
    published_at: item.publishedAt,
    analyzed_at: item.analyzedAt || new Date().toISOString(),
    scored_by: "central-agent",
    price_brain_score: item.priceBrainScore as
      | Record<string, unknown>
      | undefined,
    sub_scores: item.subScores as unknown as
      | Record<string, unknown>
      | undefined,
    risk_type: item.riskType ?? undefined,
    agent_note: item.agentNote ?? undefined,
    agent_note_generated_at: item.agentNoteGeneratedAt ?? undefined,
    econ_data: item.econData as Record<string, unknown> | undefined,
  };
}

/**
 * Run one scoring cycle: fetch unscored → enrich → write scored.
 * Exported so the refresh handler can trigger immediate scoring
 * without waiting for the 30s interval.
 */
export async function scoringCycle(): Promise<void> {
  if (isScoring) return;
  isScoring = true;

  try {
    const unscoredItems = await readUnscoredItems(BATCH_SIZE);
    if (unscoredItems.length === 0) {
      // Log periodically so stalled scoring is never invisible
      if (Date.now() % 300_000 < SCORING_INTERVAL) {
        log.info("Scoring cycle: 0 unscored items (pipeline healthy)");
      }
      return;
    }

    log.info(`Processing ${unscoredItems.length} unscored items`);

    // Build a map of tweet_id → raw Supabase id for linking
    const rawIdMap = new Map<string, string>();
    const feedItems = unscoredItems.map((raw) => {
      rawIdMap.set(raw.tweet_id, raw.id);
      return rawToFeedItem(raw);
    });

    // Run through the existing AI enrichment pipeline (Grok analyzer)
    // Graceful degradation: if AI enrichment fails entirely, proceed with
    // deterministic-only items so the feed is never empty.
    let enrichedItems: FeedItem[];
    try {
      enrichedItems = await enrichFeedWithAnalysis(feedItems);
    } catch (enrichErr) {
      log.warn("AI enrichment failed, using deterministic scores only:", {
        error:
          enrichErr instanceof Error ? enrichErr.message : String(enrichErr),
      });
      enrichedItems = feedItems;
    }

    // Classify risk type for enriched items
    for (const item of enrichedItems) {
      if (!item.riskType) {
        item.riskType = classifyRiskType(item.headline, item.tags || []);
      }
    }

    // Subject tagging for MiroShark persona routing (anti-groupthink)
    for (const item of enrichedItems) {
      const subjectTags = tagHeadlineSubjects(item.headline, item.tags || []);
      if (subjectTags.length > 0) {
        if (!item.tags) item.tags = [];
        // Store subject tags with 'subj:' prefix to distinguish from other tags
        for (const st of subjectTags) {
          const prefixed = `subj:${st}`;
          if (!item.tags.includes(prefixed)) item.tags.push(prefixed);
        }
      }
    }

    // POI Priority Boost: Commentary is a primary market driver.
    // Any headline mentioning a Person of Interest gets boosted.
    let poiBoostedCount = 0;
    for (const item of enrichedItems) {
      const poiName = applyPOIBoost(item);
      if (poiName) {
        poiBoostedCount++;
        log.info(
          ` POI boost: "${item.headline.slice(0, 60)}..." → macroLevel ${item.macroLevel} (${poiName})`,
        );
        // Override risk type to Commentary if currently unclassified
        if (item.riskType === "Commentary" || !item.riskType) {
          item.riskType = "Commentary";
        }
      }
    }
    if (poiBoostedCount > 0) {
      log.info(` POI-boosted ${poiBoostedCount} items`);
    }

    // Phase T4: Record autoresearch observations for items with IV scores
    const instrument = process.env.PRIMARY_INSTRUMENT || "/ES";
    let observationCount = 0;
    const vixData = await fetchVIX().catch(() => null);
    const vixLevel = vixData?.level ?? 0;

    // Fetch real instrument price for observation accuracy tracking
    const livePrice = await resolvePriceAt(instrument, new Date()).catch(
      () => null,
    );
    const currentPrice =
      livePrice ?? getInstrumentConfig(instrument)?.currentPrice ?? 0;

    for (const item of enrichedItems) {
      if (!item.ivScore || item.ivScore <= 0) continue;
      observationCount++;
      recordObservation({
        id: item.id,
        headline: item.headline,
        eventType: item.tags?.[0] || "news",
        ivScore: item.ivScore,
        vixLevel,
        instrument,
        currentPrice,
        publishedAt: item.publishedAt,
        source: item.source,
        tags: item.tags,
      }).catch((err) => {
        log.error(` Observation recording failed for ${item.id}:`, err);
      });
    }

    if (observationCount > 0) {
      log.info(` Recorded ${observationCount} autoresearch observations`);
    }

    // Reactive MiroShark adjustment: high-impact items trigger running analysis update
    for (const item of enrichedItems) {
      if (item.macroLevel && shouldTriggerReactiveAdjustment(item.macroLevel)) {
        const currentState = getRunningState();
        if (currentState) {
          const updated = adjustScoresForRiskFlow(currentState, {
            id: item.id,
            headline: item.headline,
            tags: item.tags || [],
            ivScore: item.ivScore || 0,
            macroLevel: item.macroLevel,
            sentiment: item.sentiment || "neutral",
          });
          setRunningState(updated);
          log.info(
            ` Reactive MiroShark adjustment: ${item.headline.slice(0, 60)}... → composite ${updated.compositeIV.toFixed(1)}`,
          );
        }
      }
    }

    // [claude-code 2026-04-06] Drop Low/Medium (macroLevel 1-2) from web scrapes.
    // Only High (3) and Critical (4) from Exa/commentary are worth keeping.
    // Twitter CLI items keep all levels.
    const WEB_SCRAPE_PREFIXES = [
      "exa-",
      "commentary-scraper:",
      "feed-poller:exa",
    ];
    const beforeCount = enrichedItems.length;
    enrichedItems = enrichedItems.filter((item) => {
      const ml = item.macroLevel ?? 1;
      if (ml >= 3) return true; // Always keep High/Critical
      // Check if this item came from a web scrape source
      const rawId = rawIdMap.get(item.id);
      const rawItem = rawId ? unscoredItems.find((r) => r.id === rawId) : null;
      const submittedBy = (rawItem as any)?.submitted_by ?? "";
      const isWebScrape = WEB_SCRAPE_PREFIXES.some((p) =>
        submittedBy.startsWith(p),
      );
      return !isWebScrape; // Keep non-web-scrape items at any level
    });
    const dropped = beforeCount - enrichedItems.length;
    if (dropped > 0) {
      log.info(
        ` Dropped ${dropped} Low/Medium web scrape items (kept ${enrichedItems.length})`,
      );
    }

    // Convert back to scored format and write to Supabase
    const scoredItems = enrichedItems.map((item) => {
      const rawId = rawIdMap.get(item.id) || null;
      return feedItemToScored(item, rawId as any);
    });

    const written = await writeScoredItems(scoredItems);
    log.info(` Wrote ${written} scored items to Supabase`);

    // Catalyst Watch — match scored items against user watchlist phrases
    try {
      const activePhrases = await getAllActivePhrases();
      if (activePhrases.length > 0) {
        for (const item of enrichedItems) {
          const headline = item.headline || "";
          const tags = item.tags || [];
          for (const phrase of activePhrases) {
            if (phraseMatchesItem(phrase, headline, tags)) {
              log.info(`[CatalystWatch] Phrase "${phrase.phrase}" matched: "${headline}"`);
              recordMatch(phrase.id).catch(() => {});
              // Push match to Consilium for visibility
              writeConsiliumMessage({
                agent_name: "CatalystWatch",
                agent_role: "catalyst-alert",
                content: `[Alert] "${phrase.phrase}" matched: ${headline}`,
                message_type: "CatalystWatch-Alert",
                metadata: {
                  phraseId: phrase.id,
                  userId: phrase.userId,
                  source: item.source,
                  itemId: item.id,
                },
              }).catch(() => {});
            }
          }
        }
      }
    } catch (err) {
      log.warn("[CatalystWatch] Phrase matching failed", { error: String(err) });
    }

    // Push High/Critical items to Consilium so they appear in the agent chat
    for (const item of enrichedItems) {
      if (item.macroLevel && item.macroLevel >= 3) {
        const tier = item.macroLevel === 4 ? "Critical" : "High";
        writeConsiliumMessage({
          agent_name: "CentralScorer",
          agent_role: "riskflow-scorer",
          content: `[${tier}] ${item.headline}`,
          message_type: `RiskFlow-${tier}`,
          metadata: { source: item.source, itemId: item.id },
        }).catch((err) =>
          log.warn("Consilium push failed", { error: String(err) }),
        );
      }
    }

    // Notify Harper autonomous loop about Level 4 items
    for (const item of enrichedItems) {
      if (item.macroLevel === 4) {
        try {
          const { enqueueTask, isAlive } =
            await import("../harper-autonomous/index.js");
          if (isAlive()) {
            enqueueTask({
              type: "level4-item",
              payload: {
                itemId: item.id,
                headline: item.headline,
                macroLevel: item.macroLevel,
                source: item.source,
              },
              priority: "high",
            });
          }
        } catch {
          /* Harper autonomous not loaded */
        }
      }
    }

    // S3: Auto-generate agent notes for critical items + econ data items
    const hasCritical = enrichedItems.some((i) => i.macroLevel === 4);
    const hasEcon = enrichedItems.some((i) => i.econData?.beatMiss);
    if (hasCritical) {
      generateNotesForCriticalItems().catch((err) =>
        log.warn("Auto-notes for critical items failed", {
          error: String(err),
        }),
      );
    }
    if (hasEcon) {
      generateNotesForEconItems().catch((err) =>
        log.warn("Auto-notes for econ items failed", { error: String(err) }),
      );
    }
  } catch (err) {
    log.error(" Scoring cycle error:", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    isScoring = false;
  }
}

/**
 * Convert a ScoredRiskFlowItem back into a FeedItem for re-enrichment.
 * Exported for reuse by getCachedFeed() when reading from the scored table.
 */
export function scoredToFeedItem(scored: ScoredRiskFlowItem): FeedItem {
  const pbs = scored.price_brain_score as Record<string, any> | undefined;
  return {
    id: scored.tweet_id,
    source: normalizeSource(
      scored.source,
      scored.headline || "",
      scored.tags || [],
    ),
    headline: scored.headline || "",
    body: scored.body,
    url: scored.url,
    symbols: scored.symbols || [],
    tags: scored.tags || [],
    isBreaking: scored.is_breaking || false,
    urgency: (scored.urgency as FeedItem["urgency"]) || "normal",
    publishedAt: scored.published_at || new Date().toISOString(),
    sentiment: scored.sentiment as FeedItem["sentiment"],
    ivScore: scored.iv_score,
    macroLevel: scored.macro_level as FeedItem["macroLevel"],
    analyzedAt: scored.analyzed_at,
    subScores: (pbs?.subScores ??
      scored.sub_scores) as unknown as FeedItem["subScores"],
    riskType: (pbs?.riskType as FeedItem["riskType"]) ?? null,
    agentNote: pbs?.agentNote ?? null,
    agentNoteGeneratedAt: pbs?.agentNoteGeneratedAt ?? null,
    econData: (pbs?.econData as FeedItem["econData"]) ?? null,
    promotedAt: (scored as any).promoted_at ?? null,
    category: (scored as any).category ?? null,
    status: (scored as any).status ?? null,
    marketImpact: pbs?.marketImpact ?? null,
  };
}

/**
 * Re-enrich already-scored items from the last 4 hours.
 * Called by VIX trigger system when market conditions change.
 * Returns the number of items updated.
 */
export async function rescoreCycle(): Promise<number> {
  const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const scoredItems = await readScoredItems({ since, limit: 30 });
  if (scoredItems.length === 0) return 0;

  const feedItems = scoredItems.map(scoredToFeedItem);
  const reEnriched = await enrichFeedWithAnalysis(feedItems);

  const updatedScored = reEnriched.map((item, i) =>
    feedItemToScored(item, scoredItems[i].raw_item_id || ""),
  );
  const written = await writeScoredItems(updatedScored);

  log.info(`Rescore complete: ${written}/${scoredItems.length} items updated`);
  return written;
}

/**
 * Start the central scoring poller
 */
export function startCentralScorer(): void {
  if (!ENABLE_CENTRAL_SCORING) {
    log.info(" Disabled (set ENABLE_CENTRAL_SCORING=true to enable)");
    return;
  }

  if (!isSupabaseConfigured()) {
    log.warn(" Supabase not configured — cannot start");
    return;
  }

  log.info(
    ` Starting (interval: ${SCORING_INTERVAL / 1000}s, batch: ${BATCH_SIZE})`,
  );

  // Run immediately, then on interval
  scoringCycle();
  scoringTimer = setInterval(scoringCycle, SCORING_INTERVAL);
}

/**
 * Stop the central scoring poller
 */
export function stopCentralScorer(): void {
  if (scoringTimer) {
    clearInterval(scoringTimer);
    scoringTimer = null;
    log.info(" Stopped");
  }
}

export function isCentralScorerRunning(): boolean {
  return scoringTimer !== null;
}
