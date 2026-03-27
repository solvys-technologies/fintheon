// [claude-code 2026-03-26] Fix currentPrice: 0 → fetch real instrument price for autoresearch observations
// [claude-code 2026-03-24] Added reactive MiroFish adjustment loop for high-impact items (macroLevel >= 3)
// [claude-code 2026-03-23] Central scoring agent — polls unscored items from Supabase, runs AI analysis, writes scored results
// Gated by ENABLE_CENTRAL_SCORING=true (only TP's instance should set this)
// Phase T4: wired recordObservation() to feed autoresearch scoring pipeline
import { enrichFeedWithAnalysis } from './feed-service.js';
import {
  readUnscoredItems,
  readScoredItems,
  writeScoredItems,
  type RawRiskFlowItem,
  type ScoredRiskFlowItem,
} from '../supabase-service.js';
import { isSupabaseConfigured } from '../../config/supabase.js';
import type { FeedItem } from '../../types/riskflow.js';
import { createLogger } from '../../lib/logger.js';
import { recordObservation } from '../autoresearch/scoring-observer.js';
import { resolvePriceAt } from '../autoresearch/price-resolver.js';
import { getInstrumentConfig } from '../iv-scoring-v2.js';
import { fetchVIX } from '../vix-service.js';
import { shouldTriggerReactiveAdjustment, adjustScoresForRiskFlow, getRunningState, setRunningState } from '../mirofish/mirofish-reactive.js';
import { generateNotesForCriticalItems } from './agent-notes.js';

const log = createLogger('CentralScorer');

// ── Risk Type Classification ─────────────────────────────────────────────────

const RISK_TYPE_KEYWORDS: Record<string, string[]> = {
  Macro: ['fed', 'fomc', 'cpi', 'ppi', 'gdp', 'nfp', 'pce', 'rate', 'inflation', 'unemployment', 'jobless', 'retail sales', 'housing starts', 'consumer confidence'],
  Geopolitical: ['war', 'tariff', 'sanction', 'military', 'conflict', 'opec', 'nato', 'invasion', 'missile', 'nuclear'],
  Earnings: ['earnings', 'eps', 'revenue', 'guidance', 'beat', 'miss', 'quarterly', 'fiscal'],
  Technical: ['resistance', 'support', 'breakout', 'volume', 'rsi', 'macd', 'moving average', 'fibonacci', 'trend'],
  Credit: ['credit spread', 'high yield', 'leverage', 'margin', 'default', 'downgrade', 'junk bond'],
  Liquidity: ['repo', 'funding', 'liquidity', 'bank run', 'cash crunch', 'reserve'],
};

/** Classify a headline + tags into a risk category using keyword matching */
export function classifyRiskType(headline: string, tags: string[]): FeedItem['riskType'] {
  const text = (headline + ' ' + tags.join(' ')).toLowerCase();
  let bestType: FeedItem['riskType'] = 'Commentary';
  let bestCount = 0;

  for (const [riskType, keywords] of Object.entries(RISK_TYPE_KEYWORDS)) {
    let count = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestType = riskType as FeedItem['riskType'];
    }
  }

  return bestType;
}

const SCORING_INTERVAL = 30_000; // 30 seconds
const BATCH_SIZE = 20;
const ENABLE_CENTRAL_SCORING = process.env.ENABLE_CENTRAL_SCORING === 'true';

let scoringTimer: ReturnType<typeof setInterval> | null = null;
let isScoring = false;

/**
 * Convert a raw Supabase item into a FeedItem for the existing enrichment pipeline
 */
function rawToFeedItem(raw: RawRiskFlowItem & { id: string }): FeedItem {
  return {
    id: raw.tweet_id,
    source: (raw.source as FeedItem['source']) || 'TwitterCli',
    headline: raw.headline || '',
    body: raw.body,
    symbols: raw.symbols || [],
    tags: raw.tags || [],
    isBreaking: raw.is_breaking || false,
    urgency: (raw.urgency as FeedItem['urgency']) || 'normal',
    publishedAt: raw.published_at || new Date().toISOString(),
  };
}

/**
 * Convert an enriched FeedItem back to a ScoredRiskFlowItem for Supabase
 */
function feedItemToScored(item: FeedItem, rawId: string): ScoredRiskFlowItem {
  return {
    raw_item_id: rawId,
    tweet_id: item.id,
    source: item.source,
    headline: item.headline,
    body: item.body,
    symbols: item.symbols,
    tags: item.tags,
    is_breaking: item.isBreaking,
    urgency: item.urgency,
    sentiment: item.sentiment,
    iv_score: item.ivScore,
    macro_level: item.macroLevel,
    published_at: item.publishedAt,
    analyzed_at: item.analyzedAt || new Date().toISOString(),
    scored_by: 'central-agent',
    price_brain_score: item.priceBrainScore as Record<string, unknown> | undefined,
    sub_scores: item.subScores as unknown as Record<string, unknown> | undefined,
    risk_type: item.riskType ?? undefined,
    agent_note: item.agentNote ?? undefined,
    agent_note_generated_at: item.agentNoteGeneratedAt ?? undefined,
    econ_data: item.econData as Record<string, unknown> | undefined,
  };
}

/**
 * Run one scoring cycle: fetch unscored → enrich → write scored
 */
async function scoringCycle(): Promise<void> {
  if (isScoring) return;
  isScoring = true;

  try {
    const unscoredItems = await readUnscoredItems(BATCH_SIZE);
    if (unscoredItems.length === 0) {
      return;
    }

    log.info(` Processing ${unscoredItems.length} unscored items`);

    // Build a map of tweet_id → raw Supabase id for linking
    const rawIdMap = new Map<string, string>();
    const feedItems = unscoredItems.map((raw) => {
      rawIdMap.set(raw.tweet_id, raw.id);
      return rawToFeedItem(raw);
    });

    // Run through the existing AI enrichment pipeline (Grok analyzer)
    const enrichedItems = await enrichFeedWithAnalysis(feedItems);

    // Classify risk type for enriched items
    for (const item of enrichedItems) {
      if (!item.riskType) {
        item.riskType = classifyRiskType(item.headline, item.tags || []);
      }
    }

    // Phase T4: Record autoresearch observations for items with IV scores
    const instrument = process.env.PRIMARY_INSTRUMENT || '/ES';
    let observationCount = 0;
    const vixData = await fetchVIX().catch(() => null);
    const vixLevel = vixData?.level ?? 0;

    // Fetch real instrument price for observation accuracy tracking
    const livePrice = await resolvePriceAt(instrument, new Date()).catch(() => null);
    const currentPrice = livePrice ?? getInstrumentConfig(instrument)?.currentPrice ?? 0;

    for (const item of enrichedItems) {
      if (!item.ivScore || item.ivScore <= 0) continue;
      observationCount++;
      recordObservation({
        id: item.id,
        headline: item.headline,
        eventType: item.tags?.[0] || 'news',
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

    // Reactive MiroFish adjustment: high-impact items trigger running analysis update
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
            sentiment: item.sentiment || 'neutral',
          });
          setRunningState(updated);
          log.info(` Reactive MiroFish adjustment: ${item.headline.slice(0, 60)}... → composite ${updated.compositeIV.toFixed(1)}`);
        }
      }
    }

    // Convert back to scored format and write to Supabase
    const scoredItems = enrichedItems.map((item) => {
      const rawId = rawIdMap.get(item.id) || '';
      return feedItemToScored(item, rawId);
    });

    const written = await writeScoredItems(scoredItems);
    log.info(` Wrote ${written} scored items to Supabase`);

    // S3: Auto-generate agent notes for any critical items that were just scored
    const hasCritical = enrichedItems.some(i => i.macroLevel === 4);
    if (hasCritical) {
      generateNotesForCriticalItems().catch(err =>
        log.warn('Auto-notes after scoring failed', { error: String(err) })
      );
    }
  } catch (err) {
    log.error(' Scoring cycle error:', { error: err instanceof Error ? err.message : String(err) });
  } finally {
    isScoring = false;
  }
}

/**
 * Convert a ScoredRiskFlowItem back into a FeedItem for re-enrichment.
 * Exported for reuse by getCachedFeed() when reading from the scored table.
 */
export function scoredToFeedItem(scored: ScoredRiskFlowItem): FeedItem {
  return {
    id: scored.tweet_id,
    source: (scored.source as FeedItem['source']) || 'TwitterCli',
    headline: scored.headline || '',
    body: scored.body,
    symbols: scored.symbols || [],
    tags: scored.tags || [],
    isBreaking: scored.is_breaking || false,
    urgency: (scored.urgency as FeedItem['urgency']) || 'normal',
    publishedAt: scored.published_at || new Date().toISOString(),
    sentiment: scored.sentiment as FeedItem['sentiment'],
    ivScore: scored.iv_score,
    macroLevel: scored.macro_level as FeedItem['macroLevel'],
    analyzedAt: scored.analyzed_at,
    subScores: scored.sub_scores as unknown as FeedItem['subScores'],
    riskType: (scored.risk_type as FeedItem['riskType']) ?? null,
    agentNote: scored.agent_note ?? null,
    agentNoteGeneratedAt: scored.agent_note_generated_at ?? null,
    econData: scored.econ_data as FeedItem['econData'] ?? null,
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
    feedItemToScored(item, scoredItems[i].raw_item_id || '')
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
    log.info(' Disabled (set ENABLE_CENTRAL_SCORING=true to enable)');
    return;
  }

  if (!isSupabaseConfigured()) {
    log.warn(' Supabase not configured — cannot start');
    return;
  }

  log.info(` Starting (interval: ${SCORING_INTERVAL / 1000}s, batch: ${BATCH_SIZE})`);

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
    log.info(' Stopped');
  }
}

export function isCentralScorerRunning(): boolean {
  return scoringTimer !== null;
}
