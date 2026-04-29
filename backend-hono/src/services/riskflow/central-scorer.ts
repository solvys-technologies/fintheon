// [claude-code 2026-04-24] S34-T4: wired drop-counter bumps at every scorer
// drop site (content-guard, dismissed-pattern, narrative gate, web-scrape
// below-threshold) so the per-source signal-noise endpoint reflects them.
// [claude-code 2026-04-19] S24-T2: SCORING_V4 walk-back pair detection after write, before push emit
// [claude-code 2026-04-16] S20-T9: Split into scorer-tagging.ts + scorer-watchlist.ts — this file is now the pipeline orchestrator
// [claude-code 2026-04-12] Fix stuck scorer: staleness guard (90s force-reset), defensive tick logging, delayed initial cycle for DB pool warmup
// [claude-code 2026-03-31] POI priority boost — Top 3 POI = Critical (macroLevel 4), Top 8 = High (macroLevel 3)
// [claude-code 2026-03-26] Fix currentPrice: 0 → fetch real instrument price for autoresearch observations
// [claude-code 2026-03-24] Added reactive AgentDesk adjustment loop for high-impact items (macroLevel >= 3)
// [claude-code 2026-03-23] Central scoring agent — polls unscored items from Supabase, runs AI analysis, writes scored results
// Gated by ENABLE_CENTRAL_SCORING=true (only TP's instance should set this)
// Phase T4: wired recordObservation() to feed autoresearch scoring pipeline
import { enrichFeedWithAnalysis } from "./feed-service.js";
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
import { getInstrumentConfig } from "../iv-scoring/index.js";
import { fetchVIX } from "../vix-service.js";
import {
  shouldTriggerReactiveAdjustment,
  adjustScoresForRiskFlow,
  getRunningState,
  setRunningState,
} from "../agent-desk/agent-desk-reactive.js";
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
import { checkContentGuard, isBannedPublisher } from "./content-guard.js";
import { bumpCounter } from "./drop-counters.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { normalizeHeadline } from "./text-utils.js";

// Re-export from extracted modules for backward compatibility
export { normalizeSource, classifyRiskType } from "./scorer-tagging.js";
export { matchPersonOfInterest, applyPOIBoost } from "./scorer-watchlist.js";

import {
  normalizeSource,
  classifyRiskType,
  matchesAnyNarrative,
  loadDismissedPatterns,
  isSimilarToDismissed,
} from "./scorer-tagging.js";
import { applyPOIBoost } from "./scorer-watchlist.js";

const log = createLogger("CentralScorer");

const SCORING_INTERVAL = 30_000;
const BATCH_SIZE = 20;
const ENABLE_CENTRAL_SCORING = process.env.ENABLE_CENTRAL_SCORING === "true";
const SCORING_STALE_MS = 90_000;

let scoringTimer: ReturnType<typeof setInterval> | null = null;
let isScoring = false;
let scoringStartedAt = 0;

function rawToFeedItem(raw: RawRiskFlowItem & { id: string }): FeedItem {
  return {
    id: raw.tweet_id,
    source: normalizeSource(raw.source, raw.headline || "", raw.tags || []),
    headline: raw.headline || "",
    body: raw.body,
    url: raw.url,
    imageUrl: raw.image_url ?? null,
    videoUrl: raw.video_url ?? null,
    symbols: raw.symbols || [],
    tags: raw.tags || [],
    isBreaking: raw.is_breaking || false,
    urgency: (raw.urgency as FeedItem["urgency"]) || "normal",
    publishedAt: raw.published_at || new Date().toISOString(),
  };
}

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
    image_url: item.imageUrl ?? null,
    video_url: item.videoUrl ?? null,
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

export async function scoringCycle(): Promise<number> {
  // [claude-code 2026-04-12] Staleness guard: if isScoring has been true for >90s, force-reset
  if (isScoring) {
    const elapsed = Date.now() - scoringStartedAt;
    if (elapsed > SCORING_STALE_MS) {
      log.warn(
        `Scoring mutex stuck for ${Math.round(elapsed / 1000)}s — force-resetting`,
      );
      isScoring = false;
    } else {
      log.info(
        `Scoring cycle skipped (already running for ${Math.round(elapsed / 1000)}s)`,
      );
      return 0;
    }
  }
  isScoring = true;
  scoringStartedAt = Date.now();

  try {
    log.info("Scoring cycle tick — fetching unscored items");
    const unscoredItems = await readUnscoredItems(BATCH_SIZE);
    if (unscoredItems.length === 0) {
      if (Date.now() % 300_000 < SCORING_INTERVAL) {
        log.info("Scoring cycle: 0 unscored items (pipeline healthy)");
      }
      return 0;
    }

    log.info(`Processing ${unscoredItems.length} unscored items`);

    const rawIdMap = new Map<string, string>();
    const feedItems = unscoredItems.map((raw) => {
      rawIdMap.set(raw.tweet_id, raw.id);
      return rawToFeedItem(raw);
    });

    // Content guard safety net
    // [claude-code 2026-04-26] Banned-publisher URL/host gate added alongside
    // text content-guard. The main-backend ingest path (FinancialJuice /
    // EconomicCalendar relays) was writing rows whose URL pointed at
    // bloomberg.com / cnbc.com / etc. because the text-only guard never
    // checked the link target. This is the single source of the leak that
    // kept resurrecting purged headlines.
    const blockedIds = new Set<string>();
    // [claude-code 2026-04-29] S48-T5: speculationDemote IDs — apply 0.7×
    // factor to ivScore after AI enrichment, before write.
    const speculationDemoteIds = new Set<string>();
    const guardedFeedItems = feedItems.filter((item) => {
      if (isBannedPublisher({ url: item.url, tags: item.tags ?? [] })) {
        blockedIds.add(item.id);
        bumpCounter(
          item.source || "unknown",
          "central-scorer",
          "banned-publisher-host",
        );
        log.info(
          `Banned-publisher host blocked: ${item.url} — ${item.headline.slice(0, 80)}`,
        );
        return false;
      }
      const rawId = rawIdMap.get(item.id);
      const rawItem = rawId ? unscoredItems.find((r) => r.id === rawId) : null;
      const ingestPipeline =
        (rawItem as { ingest_pipeline?: string } | null | undefined)
          ?.ingest_pipeline ?? undefined;
      const result = checkContentGuard(`${item.headline} ${item.body || ""}`, {
        sourceType: "wire",
        ingestPipeline,
      });
      if (result.blocked) {
        blockedIds.add(item.id);
        bumpCounter(
          item.source || "unknown",
          "central-scorer",
          result.reason || "content-guard-unknown",
        );
        log.info(
          `Content guard blocked in scorer: [${result.reason}] ${item.headline.slice(0, 80)}`,
        );
        return false;
      }
      if (result.speculationDemote) {
        speculationDemoteIds.add(item.id);
      }
      return true;
    });

    if (blockedIds.size > 0) {
      const blockedScored = feedItems
        .filter((item) => blockedIds.has(item.id))
        .map((item) => {
          item.macroLevel = 0 as any;
          item.sentiment = "neutral";
          item.ivScore = 0;
          const rawId = rawIdMap.get(item.id) || null;
          return feedItemToScored(item, rawId as any);
        });
      await writeScoredItems(blockedScored).catch(() => {});
      log.info(
        `Wrote ${blockedScored.length} content-guard-blocked items as scored (macroLevel 0)`,
      );
    }

    // ── Dismissed-pattern filter ──────────────────────────────────────────
    const dismissed = await loadDismissedPatterns().catch(() => []);
    if (dismissed.length > 0) {
      const dismissedMatchIds = new Set<string>();
      for (const item of guardedFeedItems) {
        if (isSimilarToDismissed(item.headline, dismissed)) {
          dismissedMatchIds.add(item.id);
          bumpCounter(
            item.source || "unknown",
            "central-scorer",
            "dropped_dismissed_pattern",
          );
          log.info(`Dismissed-pattern match: "${item.headline.slice(0, 60)}"`);
        }
      }
      if (dismissedMatchIds.size > 0) {
        const dismissedScored = guardedFeedItems
          .filter((item) => dismissedMatchIds.has(item.id))
          .map((item) => {
            item.macroLevel = 0 as any;
            item.sentiment = "neutral";
            item.ivScore = 0;
            const rawId = rawIdMap.get(item.id) || null;
            return feedItemToScored(item, rawId as any);
          });
        await writeScoredItems(dismissedScored).catch(() => {});
        const remaining = guardedFeedItems.filter(
          (item) => !dismissedMatchIds.has(item.id),
        );
        guardedFeedItems.length = 0;
        guardedFeedItems.push(...remaining);
        log.info(
          `Dismissed-pattern filter removed ${dismissedMatchIds.size} items`,
        );
      }
    }

    // ── Narrative gate ──────────────────────────────────────────────────
    const narrativeDropIds = new Set<string>();
    for (const item of guardedFeedItems) {
      const fullText = `${item.headline} ${item.body || ""} ${(item.tags || []).join(" ")}`;
      if (!matchesAnyNarrative(fullText)) {
        narrativeDropIds.add(item.id);
        bumpCounter(
          item.source || "unknown",
          "central-scorer",
          "dropped_narrative_gate",
        );
        log.info(`Narrative gate dropped: "${item.headline.slice(0, 60)}"`);
      }
    }
    if (narrativeDropIds.size > 0) {
      const droppedScored = guardedFeedItems
        .filter((item) => narrativeDropIds.has(item.id))
        .map((item) => {
          item.macroLevel = 0 as any;
          item.sentiment = "neutral";
          item.ivScore = 0;
          const rawId = rawIdMap.get(item.id) || null;
          return feedItemToScored(item, rawId as any);
        });
      await writeScoredItems(droppedScored).catch(() => {});
      const remaining = guardedFeedItems.filter(
        (item) => !narrativeDropIds.has(item.id),
      );
      guardedFeedItems.length = 0;
      guardedFeedItems.push(...remaining);
      log.info(
        `Narrative gate removed ${narrativeDropIds.size} items (no active narrative match)`,
      );
    }

    if (guardedFeedItems.length === 0) {
      log.info(
        "All items filtered by content guard / dismissed / narrative gate",
      );
      return (
        blockedIds.size + (dismissed.length > 0 ? 0 : 0) + narrativeDropIds.size
      );
    }

    // AI enrichment pipeline (Grok analyzer)
    let enrichedItems: FeedItem[];
    try {
      enrichedItems = await enrichFeedWithAnalysis(guardedFeedItems);
    } catch (enrichErr) {
      log.warn("AI enrichment failed, using deterministic scores only:", {
        error:
          enrichErr instanceof Error ? enrichErr.message : String(enrichErr),
      });
      enrichedItems = feedItems;
    }

    // Classify risk type
    for (const item of enrichedItems) {
      if (!item.riskType) {
        item.riskType = classifyRiskType(item.headline, item.tags || []);
      }
    }

    // Subject tagging for AgentDesk persona routing
    for (const item of enrichedItems) {
      const subjectTags = tagHeadlineSubjects(item.headline, item.tags || []);
      if (subjectTags.length > 0) {
        if (!item.tags) item.tags = [];
        for (const st of subjectTags) {
          const prefixed = `subj:${st}`;
          if (!item.tags.includes(prefixed)) item.tags.push(prefixed);
        }
      }
    }

    // POI Priority Boost
    let poiBoostedCount = 0;
    for (const item of enrichedItems) {
      const poiName = applyPOIBoost(item);
      if (poiName) {
        poiBoostedCount++;
        log.info(
          ` POI boost: "${item.headline.slice(0, 60)}..." → macroLevel ${item.macroLevel} (${poiName})`,
        );
        if (item.riskType === "Commentary" || !item.riskType) {
          item.riskType = "Commentary";
        }
      }
    }
    if (poiBoostedCount > 0) {
      log.info(` POI-boosted ${poiBoostedCount} items`);
    }

    // Autoresearch observations
    const instrument = process.env.PRIMARY_INSTRUMENT || "/ES";
    let observationCount = 0;
    const vixData = await fetchVIX().catch(() => null);
    const vixLevel = vixData?.level ?? 0;

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

    // Reactive AgentDesk adjustment
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
            ` Reactive AgentDesk adjustment: ${item.headline.slice(0, 60)}... → composite ${updated.compositeIV.toFixed(1)}`,
          );
        }
      }
    }

    // [claude-code 2026-04-06] Drop Low/Medium (macroLevel 1-2) from web scrapes.
    // [claude-code 2026-04-12] Dropped items MUST still be written to scored table
    const WEB_SCRAPE_PREFIXES = [
      "exa-",
      "commentary-scraper:",
      "feed-poller:exa",
    ];
    const droppedItems: FeedItem[] = [];
    enrichedItems = enrichedItems.filter((item) => {
      const ml = item.macroLevel ?? 1;
      if (ml >= 3) return true;
      const rawId = rawIdMap.get(item.id);
      const rawItem = rawId ? unscoredItems.find((r) => r.id === rawId) : null;
      const submittedBy = (rawItem as any)?.submitted_by ?? "";
      const isWebScrape = WEB_SCRAPE_PREFIXES.some((p) =>
        submittedBy.startsWith(p),
      );
      if (isWebScrape) {
        droppedItems.push(item);
        bumpCounter(
          item.source || "unknown",
          "central-scorer",
          "dropped_below_threshold",
        );
      }
      return !isWebScrape;
    });
    if (droppedItems.length > 0) {
      log.info(
        ` Dropped ${droppedItems.length} Low/Medium web scrape items (kept ${enrichedItems.length})`,
      );
    }

    // [claude-code 2026-04-29] S48-T5: apply 0.7× speculation-demote factor
    // to ivScore for items flagged by content-guard gate 5.5 before write.
    if (speculationDemoteIds.size > 0) {
      const { SPECULATION_DEMOTE_FACTOR } =
        await import("./speculation-filter.js");
      let demotedCount = 0;
      for (const item of enrichedItems) {
        if (!speculationDemoteIds.has(item.id)) continue;
        if (typeof item.ivScore === "number" && item.ivScore > 0) {
          item.ivScore = Math.round(item.ivScore * SPECULATION_DEMOTE_FACTOR);
          demotedCount++;
        }
      }
      if (demotedCount > 0) {
        log.info(
          `Applied speculation demote (×${SPECULATION_DEMOTE_FACTOR}) to ${demotedCount} items`,
        );
      }
    }

    // Write scored items to Supabase
    const allProcessedItems = [...enrichedItems, ...droppedItems];
    const scoredItems = allProcessedItems.map((item) => {
      const rawId = rawIdMap.get(item.id) || null;
      return feedItemToScored(item, rawId as any);
    });

    const written = await writeScoredItems(scoredItems);
    log.info(` Wrote ${written} scored items to Supabase`);

    // ── Arbitrum event trigger (S35-T1) ────────────────────────────────────
    // [claude-code 2026-04-24] S35-T1/T12 Phase B: fire-and-forget. The
    // trigger itself gates on iv_score>=8.5 + speaker in top-N commentators
    // + per-speaker cooldown. Never blocks the scorer pipeline; chamber
    // failures degrade to low-confidence stubs inside engine.ts.
    for (const item of enrichedItems) {
      if ((item.ivScore ?? 0) < 8.5) continue;
      void import("../arbitrum/event-trigger.js")
        .then((mod) => mod.checkAndFire(item))
        .catch((err) =>
          log.warn("Arbitrum event trigger threw (swallowed)", {
            item_id: item.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
    }

    // ── Walk-back pairer (SCORING_V4) ──────────────────────────────────────
    // [claude-code 2026-04-19] S24-T2: scan newly-scored L9/L10 items for
    // semantic reversals of prior L9/L10 items in the last 24h. If matched,
    // fade the original by 0.5× and fire a `walkBackReverts` critical push.
    // Regime revert is deferred to T1's proposeRegimeChange() when available.
    if (process.env.SCORING_V4 === "true") {
      try {
        const { detectWalkBack, applyFadeToOriginal } =
          await import("../scoring/walk-back-pairer.js");
        const l9l10 = enrichedItems.filter((i) => (i.ivScore ?? 0) >= 9);
        for (const item of l9l10) {
          const result = await detectWalkBack(item);
          if (result.action !== "fade" || !result.pairsWith) continue;

          const faded = await applyFadeToOriginal({
            originalId: result.pairsWith,
            fadeFactor: 0.5,
          });
          log.info(
            `Walk-back: "${item.headline.slice(0, 60)}" pairs with ${result.pairsWith} (overlap=${result.overlapScore}) faded=${faded}`,
          );

          // Propose regime revert via T1's proposals API if available.
          try {
            const mod: Record<string, unknown> =
              await import("../regime/regime-service.js");
            const propose = (mod as { proposeRegimeChange?: Function })
              .proposeRegimeChange;
            if (typeof propose === "function") {
              await propose({
                proposedBy: "walk-back-pairer",
                severity: "critical",
                reason: `walk-back: "${item.headline.slice(0, 80)}" reverses ${result.pairsWith}`,
                triggerItemId: item.id,
              });
            }
          } catch (err) {
            log.warn(
              `walk-back proposeRegimeChange unavailable: ${String(err)}`,
            );
          }

          // Fire walkBackReverts push (critical severity bypasses quiet hours).
          try {
            const { emitPushAndLog } = await import("../notifications/emit.js");
            await emitPushAndLog({
              userId: "all",
              category: "walkBackReverts",
              severity: "critical",
              title: "Walk-back detected",
              body: `"${item.headline.slice(0, 90)}" reverses a recent L9/L10`,
              url: `/riskflow/item/${item.id}`,
              fingerprint: `walkback-${result.pairsWith}`,
              metadata: {
                newItemId: item.id,
                pairedItemId: result.pairsWith,
                overlapScore: result.overlapScore,
              },
            });
          } catch (err) {
            log.warn(`walk-back push emit failed: ${String(err)}`);
          }
        }
      } catch (err) {
        log.warn("Walk-back pairer step failed (non-fatal)", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ── Push notifications ──────────────────────────────────────────────────
    // [claude-code 2026-04-18] S2/B1/B2/B3: emit.ts + fingerprint dedup + narrative coalescing + polished payload
    try {
      const highItems = enrichedItems.filter(
        (i) => i.macroLevel && i.macroLevel >= 3,
      );
      if (highItems.length > 0) {
        const { coalesceAndEmit } =
          await import("../notifications/narrative-coalesce.js");
        const { buildRiskFlowPush } =
          await import("../notifications/riskflow-payload.js");
        for (const item of highItems) {
          const payload = buildRiskFlowPush(item);
          // Coalesce by (narrativeThreads[0] OR primary symbol) — 60s debounce window.
          const narrativeKey =
            item.narrativeThreads?.[0] || item.symbols?.[0] || "generic";
          coalesceAndEmit(
            {
              userId: "all",
              category: "riskflow",
              severity: item.macroLevel === 4 ? "critical" : "high",
              ...payload,
            },
            narrativeKey,
          );
        }
        log.info(
          `Queued push notifications for ${highItems.length} high-severity items (coalesced)`,
        );
      }
    } catch {
      /* web-push not configured — skip silently */
    }

    // ── RiskFlow sanitation (4 sequential purges) ──────────────────────────
    // [claude-code 2026-04-19] Was a single zero-IV purge; now covers the four
    // classes of junk that had been accumulating: low-IV, narrative-orphans,
    // duplicate headlines, and sourceless items with no back-link to scrape.
    try {
      const sb = getSupabaseClient();
      if (sb) {
        const now = Date.now();
        const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
        const sixHoursAgo = new Date(now - 6 * 60 * 60 * 1000).toISOString();
        const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

        // 1) Low-IV: iv_score <= 1 older than 1h
        try {
          const { count: lowCount } = await sb
            .from("scored_riskflow_items")
            .delete({ count: "exact" })
            .lte("iv_score", 1)
            .lt("published_at", oneHourAgo);
          if (lowCount && lowCount > 0) {
            log.info(`Purged ${lowCount} low-IV scored items (iv<=1, >1h)`);
          }
        } catch (err) {
          log.warn("Low-IV purge failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        }

        // 2) Narrative-orphan: items older than 1h with no catalyst link,
        //    bounded to the last 6h to keep the working set flat.
        try {
          const { data: recent } = await sb
            .from("scored_riskflow_items")
            .select("tweet_id")
            .lt("published_at", oneHourAgo)
            .gt("published_at", sixHoursAgo)
            .limit(500);
          const recentIds = (recent ?? [])
            .map((r) => (r as { tweet_id: string }).tweet_id)
            .filter(Boolean);
          if (recentIds.length > 0) {
            const { data: linked } = await sb
              .from("narrative_card_links")
              .select("card_id")
              .in("card_id", recentIds);
            const linkedSet = new Set(
              (linked ?? []).map((r) => (r as { card_id: string }).card_id),
            );
            const orphans = recentIds.filter((id) => !linkedSet.has(id));
            if (orphans.length > 0) {
              const { count: orphanCount } = await sb
                .from("scored_riskflow_items")
                .delete({ count: "exact" })
                .in("tweet_id", orphans);
              if (orphanCount && orphanCount > 0) {
                log.info(
                  `Purged ${orphanCount} narrative-orphan scored items (>1h, no catalyst link)`,
                );
              }
            }
          }
        } catch (err) {
          log.warn("Narrative-orphan purge failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        }

        // 3) Headline dedup: collapse same normalized headline inside 24h,
        //    keep newest per group.
        try {
          const { data: recent24 } = await sb
            .from("scored_riskflow_items")
            .select("tweet_id,headline,published_at")
            .gt("published_at", dayAgo)
            .order("published_at", { ascending: false })
            .limit(2000);
          const seen = new Map<string, string>();
          const toDelete: string[] = [];
          for (const row of (recent24 ?? []) as Array<{
            tweet_id: string;
            headline: string | null;
          }>) {
            const headline = row.headline ?? "";
            if (!headline) continue;
            const key = normalizeHeadline(headline);
            if (!key) continue;
            const winner = seen.get(key);
            if (!winner) {
              seen.set(key, row.tweet_id);
            } else {
              toDelete.push(row.tweet_id);
            }
          }
          if (toDelete.length > 0) {
            // Delete in chunks — Supabase .in() has a practical limit.
            const CHUNK = 200;
            let total = 0;
            for (let i = 0; i < toDelete.length; i += CHUNK) {
              const chunk = toDelete.slice(i, i + CHUNK);
              const { count } = await sb
                .from("scored_riskflow_items")
                .delete({ count: "exact" })
                .in("tweet_id", chunk);
              total += count ?? 0;
            }
            if (total > 0) {
              log.info(`Purged ${total} duplicate-headline items (24h window)`);
            }
          }
        } catch (err) {
          log.warn("Headline-dedup purge failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        }

        // 4) Source-link purge: items with no way to trace back to an original.
        //    Items from these sources have their own resolvable context even
        //    without a URL, so we keep them.
        // S48-T1 Fix 4: Added EconomicCalendar — econ prints have no URL but
        // are structurally trustworthy (parsed from calendar + FJ X timeline).
        const TRUSTED_SOURCELESS = [
          "FinancialJuice",
          "DeItaOne",
          "TwitterCli",
          "OSINTSources",
          "Hermes",
          "EconomicCalendar",
        ];
        try {
          const { data: candidates } = await sb
            .from("scored_riskflow_items")
            .select("tweet_id,source,tags,url")
            .lt("published_at", oneHourAgo)
            .gt("published_at", sixHoursAgo)
            .limit(500);
          const toPurge: string[] = [];
          for (const row of (candidates ?? []) as Array<{
            tweet_id: string;
            source: string | null;
            tags: string[] | null;
            url: string | null;
          }>) {
            if (row.source && TRUSTED_SOURCELESS.includes(row.source)) continue;
            if (row.url && row.url.length > 0) continue;
            const hasUrlTag = (row.tags ?? []).some(
              (t) => typeof t === "string" && t.startsWith("url:"),
            );
            if (hasUrlTag) continue;
            toPurge.push(row.tweet_id);
          }
          if (toPurge.length > 0) {
            const CHUNK = 200;
            let total = 0;
            for (let i = 0; i < toPurge.length; i += CHUNK) {
              const chunk = toPurge.slice(i, i + CHUNK);
              const { count } = await sb
                .from("scored_riskflow_items")
                .delete({ count: "exact" })
                .in("tweet_id", chunk);
              total += count ?? 0;
            }
            if (total > 0) {
              log.info(
                `Purged ${total} sourceless items (no url, untrusted source)`,
              );
            }
          }
        } catch (err) {
          log.warn("Source-link purge failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (purgeErr) {
      log.warn("RiskFlow sanitation failed (non-fatal):", {
        error: purgeErr instanceof Error ? purgeErr.message : String(purgeErr),
      });
    }

    // ── Low-priority batch tagging for Harper ────────────────────────────
    // [claude-code 2026-04-15] S16-T5
    const lowPriorityIds = enrichedItems
      .filter((item) => (item.macroLevel ?? 1) === 1)
      .map((item) => item.id);
    if (lowPriorityIds.length > 0) {
      try {
        const { enqueueTask, isAlive } =
          await import("../harper-autonomous/index.js");
        if (isAlive()) {
          enqueueTask({
            type: "batch-review-low-priority",
            payload: { itemIds: lowPriorityIds, count: lowPriorityIds.length },
            priority: "low",
          });
          log.info(
            `Enqueued Harper batch-review for ${lowPriorityIds.length} low-priority items`,
          );
        }
      } catch {
        /* Harper autonomous not loaded */
      }
    }

    // Catalyst Watch — match scored items against user watchlist phrases
    try {
      const activePhrases = await getAllActivePhrases();
      if (activePhrases.length > 0) {
        for (const item of enrichedItems) {
          const headline = item.headline || "";
          const tags = item.tags || [];
          for (const phrase of activePhrases) {
            if (phraseMatchesItem(phrase, headline, tags)) {
              log.info(
                `[CatalystWatch] Phrase "${phrase.phrase}" matched: "${headline}"`,
              );
              recordMatch(phrase.id).catch(() => {});
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
      log.warn("[CatalystWatch] Phrase matching failed", {
        error: String(err),
      });
    }

    // Push High/Critical items to Consilium
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
    return enrichedItems.length;
  } catch (err) {
    log.error(" Scoring cycle error:", {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  } finally {
    isScoring = false;
  }
}

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
    imageUrl: scored.image_url ?? null,
    videoUrl: scored.video_url ?? null,
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
    riskType: (scored.risk_type as FeedItem["riskType"]) ?? (pbs?.riskType as FeedItem["riskType"]) ?? null,
    agentNote: pbs?.agentNote ?? null,
    agentNoteGeneratedAt: pbs?.agentNoteGeneratedAt ?? null,
    econData: (pbs?.econData as FeedItem["econData"]) ?? null,
    promotedAt: (scored as any).promoted_at ?? null,
    category: (scored as any).category ?? null,
    status: (scored as any).status ?? null,
    marketImpact: pbs?.marketImpact ?? null,
  };
}

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

  // [claude-code 2026-04-12] Delay first cycle 5s so DB pool is warm before first query.
  setTimeout(() => {
    scoringCycle().catch((err) =>
      log.error("Initial scoring cycle failed:", {
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }, 5_000);
  scoringTimer = setInterval(() => {
    scoringCycle().catch((err) =>
      log.error("Scoring interval cycle failed:", {
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }, SCORING_INTERVAL);
}

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
