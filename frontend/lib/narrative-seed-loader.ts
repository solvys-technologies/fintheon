// [claude-code 2026-03-29] alertToCatalyst: DB-backed converter using narrative threads from API (replaces client-side classification)
// [claude-code 2026-03-29] S9-T5-T1: Bump seed version to v9 to force re-seed with tags/narrative fields
// [claude-code 2026-03-29] Auto-classify RiskFlow imports into narrative threads so Timeline populates
// [claude-code 2026-03-28] S5-T3: Auto-seed pipeline — historical fixture + live RiskFlow import
import seedEvents from '../data/narrative-seed-events.json';
import type { CatalystCard, NarrativeCategory, CatalystSeverity, CatalystSentiment } from './narrative-types';
import type { RiskFlowAlert } from './riskflow-feed';

// Bump version when seed data changes to re-seed existing users
const SEED_FLAG = 'fintheon:narrative-seeded:v10';

/**
 * Load historical seed events into the narrative store.
 * Only runs once on first boot (checks localStorage flag).
 */
export function loadSeedEvents(): CatalystCard[] {
  if (localStorage.getItem(SEED_FLAG)) return [];

  const now = new Date().toISOString();
  const cards: CatalystCard[] = (seedEvents as any[]).map(e => ({
    id: e.id,
    title: e.title,
    description: e.description ?? '',
    date: e.date,
    category: e.category as NarrativeCategory,
    severity: (e.severity ?? 'medium') as CatalystSeverity,
    sentiment: (e.sentiment ?? 'bearish') as CatalystSentiment,
    source: 'user',
    narrativeIds: e.narrativeThreads ?? [],
    isGhost: false,
    templateType: null,
    position: null,
    tags: e.tags ?? [],
    narrative: e.narrative ?? undefined,
    narrativeThreads: e.narrativeThreads ?? [],
    directionBias: e.direction ?? 'neutral',
    status: 'resolved' as const,
    dateRange: { start: e.date, end: null },
    drillDepth: 0,
    createdAt: now,
    updatedAt: now,
  }));

  localStorage.setItem(SEED_FLAG, 'true');
  return cards;
}

function mapRiskType(rt: string | null | undefined): NarrativeCategory | null {
  if (!rt) return null;
  const m: Record<string, NarrativeCategory> = {
    'Macro': 'macroeconomic',
    'Geopolitical': 'geopolitical',
    'Earnings': 'earnings',
    'Technical': 'market-structure',
    'Credit': 'macroeconomic',
    'Liquidity': 'market-structure',
    'Commentary': 'macroeconomic',
  };
  return m[rt] ?? null;
}

function mapSeverity(sev: string): CatalystSeverity {
  if (sev === 'critical' || sev === 'high') return 'high';
  if (sev === 'medium') return 'medium';
  return 'low';
}

// Keyword → narrative thread mapping for auto-classification of RiskFlow imports
const THREAD_KEYWORDS: Record<string, string[]> = {
  'middle-east-conflict': ['iran', 'israel', 'hamas', 'hezbollah', 'gaza', 'middle east', 'yemen', 'houthi', 'syria', 'lebanon', 'red sea', 'strait of hormuz'],
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

// Risk type → fallback thread mapping when keywords don't match
const RISKTYPE_THREAD_FALLBACK: Record<string, string> = {
  'Geopolitical': 'middle-east-conflict',
  'Credit': 'liquidity-credit-contraction',
  'Liquidity': 'liquidity-credit-contraction',
  'Macro': 'rate-cut-cycle',
};

function classifyNarrativeThreads(headline: string, riskType?: string | null, tags?: string[]): string[] {
  const text = [headline, ...(tags ?? [])].join(' ').toLowerCase();
  const matched: string[] = [];

  for (const [thread, keywords] of Object.entries(THREAD_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      matched.push(thread);
    }
  }

  // Fallback: if no keyword match, use riskType mapping
  if (matched.length === 0 && riskType && RISKTYPE_THREAD_FALLBACK[riskType]) {
    matched.push(RISKTYPE_THREAD_FALLBACK[riskType]);
  }

  return matched;
}

/**
 * Import live RiskFlow items as editable copies.
 * Only imports items not already in the store (by riskflowItemId).
 * @deprecated Use alertToCatalyst() for DB-backed conversion
 */
export function importRiskFlowItems(
  alerts: RiskFlowAlert[],
  existingIds: Set<string>,
): CatalystCard[] {
  const now = new Date().toISOString();
  return alerts
    .filter(a => !existingIds.has(a.id))
    .slice(0, 30)
    .map(a => {
      const threads = classifyNarrativeThreads(a.headline, a.riskType, a.tags);
      return {
        id: `rf-${a.id}`,
        title: a.headline,
        description: a.summary ?? '',
        date: a.publishedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        category: mapRiskType(a.riskType) ?? 'macroeconomic',
        severity: mapSeverity(a.severity),
        sentiment: (a.direction === 'Bullish' ? 'bullish' : 'bearish') as CatalystSentiment,
        source: 'riskflow-import' as const,
        narrativeIds: threads,
        isGhost: false,
        templateType: null,
        position: null,
        tags: a.tags ?? [],
        riskflowItemId: a.id,
        narrative: threads[0] ?? undefined,
        narrativeThreads: threads,
        directionBias: a.direction === 'Bullish' ? 'bullish' : a.direction === 'Bearish' ? 'bearish' : 'neutral',
        status: 'active' as const,
        dateRange: { start: a.publishedAt?.slice(0, 10) ?? '', end: null },
        drillDepth: 0,
        createdAt: now,
        updatedAt: now,
      };
    });
}

/**
 * Convert a single RiskFlowAlert (with DB-supplied narrative data) into a CatalystCard.
 * Used by NarrativeMap to sync promoted items from the unified feed.
 * Narrative threads come from the API (populated by catalyst-promoter), not client-side keywords.
 */
export function alertToCatalyst(a: RiskFlowAlert): CatalystCard {
  const now = new Date().toISOString();
  // Use DB-supplied threads if available, fall back to client-side classification
  const threads = (a.narrativeThreads && a.narrativeThreads.length > 0)
    ? a.narrativeThreads
    : classifyNarrativeThreads(a.headline, a.riskType, a.tags);

  return {
    id: `rf-${a.id}`,
    title: a.headline,
    description: a.summary ?? '',
    date: a.publishedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    category: (a.category as NarrativeCategory) ?? mapRiskType(a.riskType) ?? 'macroeconomic',
    severity: mapSeverity(a.severity),
    sentiment: (a.direction === 'Bullish' ? 'bullish' : 'bearish') as CatalystSentiment,
    source: 'riskflow' as const,
    narrativeIds: threads,
    isGhost: false,
    templateType: null,
    position: null,
    tags: a.tags ?? [],
    riskflowItemId: a.id,
    narrative: threads[0] ?? undefined,
    narrativeThreads: threads,
    directionBias: a.direction === 'Bullish' ? 'bullish' : a.direction === 'Bearish' ? 'bearish' : 'neutral',
    status: (a.status as 'active' | 'monitoring' | 'resolved') ?? 'active',
    marketImpact: a.marketImpact ? { nq: a.marketImpact.nq ?? null, es: a.marketImpact.es ?? null, ym: a.marketImpact.ym ?? null, asOf: a.marketImpact.asOf ?? '' } : undefined,
    dateRange: { start: a.publishedAt?.slice(0, 10) ?? '', end: null },
    drillDepth: 0,
    createdAt: a.promotedAt ?? now,
    updatedAt: now,
  };
}
