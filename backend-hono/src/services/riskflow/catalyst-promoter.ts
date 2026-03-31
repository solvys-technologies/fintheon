// [claude-code 2026-03-31] Instant promotion for macroLevel 3-4 (no 30-min delay for breaking news)
// [claude-code 2026-03-29] Catalyst promotion service — graduates scored items into narrative catalysts
// Runs after central-scorer, auto-classifies narrative threads, writes to narrative_card_links
import { getSupabaseClient } from '../../config/supabase.js';
import { createLogger } from '../../lib/logger.js';
import type { ScoredRiskFlowItem } from '../supabase-service.js';

const log = createLogger('CatalystPromoter');

// ── Narrative thread keyword matching (mirrors narrative_threads.keywords in DB) ──

const THREAD_KEYWORDS: Record<string, string[]> = {
  'middle-east-conflict': ['iran', 'israel', 'hamas', 'hezbollah', 'gaza', 'middle east', 'yemen', 'houthi', 'syria', 'lebanon', 'red sea', 'strait of hormuz', 'ceasefire'],
  'liquidity-credit-contraction': ['credit', 'liquidity', 'spreads', 'high yield', 'default', 'leverage', 'margin', 'repo', 'funding', 'tightening', 'financial conditions', 'credit spread', 'junk bond', 'distressed'],
  'ai-singularity': ['ai ', ' ai', 'artificial intelligence', 'nvidia', 'nvda', 'openai', 'gpu', 'semiconductor', 'chip', 'datacenter', 'data center', 'machine learning', 'llm', 'anthropic', 'google ai', 'deepseek'],
  'usd-jpy-carry-trade': ['yen', 'jpy', 'boj', 'bank of japan', 'carry trade', 'usd/jpy', 'usdjpy', 'japanese', 'japan rate'],
  'trade-war': ['tariff', 'trade war', 'import duty', 'trade deficit', 'retaliatory', 'trade barrier', 'customs duty', 'reciprocal tariff', 'trade deal', 'trade tension'],
  'us-china-relations': ['china', 'beijing', 'chinese', 'xi jinping', 'taiwan', 'south china sea', 'us-china', 'decoupling', 'chips act'],
  'rate-cut-cycle': ['rate cut', 'rate hike', 'fed funds', 'fomc', 'powell', 'dovish', 'hawkish', 'monetary policy', 'federal reserve', 'interest rate', 'dot plot', 'fed pivot', 'rate decision', 'basis points'],
  'trump-presidency': ['trump', 'maga', 'executive order', 'white house', 'doge', 'elon musk', 'vivek', 'truth social', 'mar-a-lago'],
  'price-stability': ['cpi', 'pce', 'inflation', 'deflation', 'disinflation', 'core inflation', 'ppi', 'consumer price', 'price index', 'stagflation'],
  'maximum-employment': ['nfp', 'payroll', 'unemployment', 'jobs', 'labor market', 'jobless claims', 'employment', 'hiring', 'layoff', 'jolts', 'wage growth', 'workforce'],
};

const RISKTYPE_THREAD_FALLBACK: Record<string, string> = {
  'Geopolitical': 'middle-east-conflict',
  'Credit': 'liquidity-credit-contraction',
  'Liquidity': 'liquidity-credit-contraction',
  'Macro': 'rate-cut-cycle',
};

const RISKTYPE_CATEGORY: Record<string, string> = {
  'Macro': 'macroeconomic',
  'Geopolitical': 'geopolitical',
  'Earnings': 'earnings',
  'Technical': 'market-structure',
  'Credit': 'macroeconomic',
  'Liquidity': 'market-structure',
  'Commentary': 'macroeconomic',
};

function classifyNarrativeThreads(headline: string, riskType?: string | null, tags?: string[]): string[] {
  const text = [headline, ...(tags ?? [])].join(' ').toLowerCase();
  const matched: string[] = [];

  for (const [thread, keywords] of Object.entries(THREAD_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      matched.push(thread);
    }
  }

  if (matched.length === 0 && riskType && RISKTYPE_THREAD_FALLBACK[riskType]) {
    matched.push(RISKTYPE_THREAD_FALLBACK[riskType]);
  }

  return matched;
}

/**
 * Promote scored items into narrative catalysts.
 * Two paths:
 *   FAST: macroLevel >= 3 → instant promotion (no time cutoff)
 *   STANDARD: macroLevel 2 → promoted after 30-min settling window
 * Auto-classifies narrative threads and writes to narrative_card_links.
 */
export async function promotionCycle(): Promise<number> {
  const sb = getSupabaseClient();
  if (!sb) return 0;

  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  // FAST PATH: macroLevel >= 3 — instant promotion, no delay
  const { data: fastItems, error: fastError } = await sb
    .from('scored_riskflow_items')
    .select('tweet_id, headline, tags, price_brain_score')
    .is('promoted_at', null)
    .gte('macro_level', 3)
    .order('created_at', { ascending: false })
    .limit(50);

  // STANDARD PATH: macroLevel 2 — 30-min settling window
  const { data: standardItems, error: standardError } = await sb
    .from('scored_riskflow_items')
    .select('tweet_id, headline, tags, price_brain_score')
    .is('promoted_at', null)
    .eq('macro_level', 2)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(50);

  if (fastError) {
    log.error('Failed to read fast-path items:', { error: fastError.message });
  }
  if (standardError) {
    log.error('Failed to read standard-path items:', { error: standardError.message });
  }

  // Merge + deduplicate by tweet_id
  const seenIds = new Set<string>();
  const items: typeof fastItems = [];
  for (const item of [...(fastItems || []), ...(standardItems || [])]) {
    if (!seenIds.has(item.tweet_id)) {
      seenIds.add(item.tweet_id);
      items.push(item);
    }
  }

  if (items.length === 0) return 0;

  const fastCount = fastItems?.length ?? 0;
  const stdCount = standardItems?.length ?? 0;
  log.info(`Promoting ${items.length} items (${fastCount} instant, ${stdCount} standard)`);

  // Classify + write narrative_card_links + update promoted_at
  const cardLinks: Array<{ card_id: string; thread_slug: string; confidence: number }> = [];
  const promotedIds: string[] = [];
  const categoryUpdates: Array<{ tweet_id: string; category: string }> = [];

  for (const item of items) {
    // risk_type may be stored inside price_brain_score JSONB
    const pbs = item.price_brain_score as Record<string, any> | null;
    const riskType = pbs?.riskType ?? null;
    const threads = classifyNarrativeThreads(item.headline, riskType, item.tags);
    const category = RISKTYPE_CATEGORY[riskType] ?? 'macroeconomic';

    for (const thread of threads) {
      cardLinks.push({ card_id: item.tweet_id, thread_slug: thread, confidence: 1.0 });
    }

    promotedIds.push(item.tweet_id);
    categoryUpdates.push({ tweet_id: item.tweet_id, category });
  }

  // Write narrative_card_links (upsert to avoid duplicates)
  if (cardLinks.length > 0) {
    const { error: linkError } = await sb
      .from('narrative_card_links')
      .upsert(cardLinks, { onConflict: 'card_id,thread_slug', ignoreDuplicates: true });

    if (linkError) {
      log.error('Failed to write narrative_card_links:', { error: linkError.message });
    }
  }

  // Batch-update promoted_at + category on scored items
  let promoted = 0;
  for (const update of categoryUpdates) {
    const { error: updateError } = await sb
      .from('scored_riskflow_items')
      .update({ promoted_at: new Date().toISOString(), category: update.category })
      .eq('tweet_id', update.tweet_id);

    if (!updateError) promoted++;
  }

  log.info(`Promoted ${promoted} items, wrote ${cardLinks.length} narrative links`);
  return promoted;
}

// ── Poller integration ──────────────────────────────────────────────────────

let promotionTimer: ReturnType<typeof setInterval> | null = null;
const PROMOTION_INTERVAL = 60_000; // Run every 60 seconds

export function startCatalystPromoter(): void {
  log.info(`Starting (interval: ${PROMOTION_INTERVAL / 1000}s)`);
  promotionCycle().catch(err => log.error('Initial promotion cycle failed:', { error: String(err) }));
  promotionTimer = setInterval(() => {
    promotionCycle().catch(err => log.error('Promotion cycle failed:', { error: String(err) }));
  }, PROMOTION_INTERVAL);
}

export function stopCatalystPromoter(): void {
  if (promotionTimer) {
    clearInterval(promotionTimer);
    promotionTimer = null;
    log.info('Stopped');
  }
}
