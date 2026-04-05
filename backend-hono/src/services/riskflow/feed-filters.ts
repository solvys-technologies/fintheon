// [claude-code 2026-04-05] Extracted from feed-service.ts for <300 line policy
// Feed filtering: watchlist filters, foreign econ print stripping, mock feed generation.

import type { FeedItem, FeedFilters } from '../../types/riskflow.js';

/**
 * Apply filters to feed items
 */
export function applyFilters(items: FeedItem[], filters: FeedFilters): FeedItem[] {
  let filtered = [...items];

  if (filters.sources?.length) {
    filtered = filtered.filter(item => filters.sources!.includes(item.source));
  }

  if (filters.symbols?.length) {
    const symbolSet = new Set(filters.symbols.map(s => s.toUpperCase()));
    filtered = filtered.filter(item =>
      item.symbols.some(s => symbolSet.has(s.toUpperCase()))
    );
  }

  if (filters.tags?.length) {
    const tagSet = new Set(filters.tags.map(t => t.toUpperCase()));
    filtered = filtered.filter(item =>
      item.tags.some(t => tagSet.has(t.toUpperCase()))
    );
  }

  if (filters.breakingOnly) {
    filtered = filtered.filter(item => item.isBreaking);
  }

  if (filters.minIvScore !== undefined) {
    filtered = filtered.filter(item => (item.ivScore ?? 0) >= filters.minIvScore!);
  }

  // Filter by macro level (1-4 scale)
  if (filters.minMacroLevel !== undefined) {
    filtered = filtered.filter(item => (item.macroLevel ?? 1) >= filters.minMacroLevel!);
  }

  // Strip foreign economic DATA prints (CPI, PPI, GDP, PMI, etc.)
  // Keep foreign commentary, geopolitical, rate decisions, and persons of interest.
  filtered = filtered.filter(item => !isForeignEconPrint(item.headline));

  return filtered;
}

// Foreign country prefixes that appear before econ data keywords
const FOREIGN_PREFIXES = [
  'french', 'france', 'german', 'euro area', 'eurozone', 'japanese',
  'japan', 'chinese', 'china', 'british', 'uk ', 'canadian', 'canada',
  'swiss', 'australian', 'australia', 'brazilian', 'brazil', 'indian',
  'india', 'mexican', 'mexico', 'spanish', 'spain', 'italian', 'italy',
  'swedish', 'sweden', 'norwegian', 'norway', 'korean', 'korea',
  'turkish', 'new zealand', 'south african',
];

// Econ data keywords — if headline has FOREIGN_PREFIX + one of these, it's foreign econ data
const ECON_DATA_KEYWORDS = [
  'cpi', 'ppi', 'gdp', 'pmi', 'hicp', 'employment', 'unemployment',
  'retail sales', 'trade balance', 'current account', 'industrial production',
  'consumer confidence', 'business confidence', 'housing', 'home sales',
  'inflation', 'deflation', 'wage', 'payroll', 'manufacturing',
  'services pmi', 'composite pmi', 'factory orders', 'construction',
  'actual', 'forecast', 'previous', 'revised',
  'foreign bond investment', 'foreign investment',
  'service ppi', 'public deficit',
];

function isForeignEconPrint(headline: string): boolean {
  const lower = headline.toLowerCase();
  const hasForeignPrefix = FOREIGN_PREFIXES.some(p => lower.includes(p));
  if (!hasForeignPrefix) return false;
  const hasEconKeyword = ECON_DATA_KEYWORDS.some(k => lower.includes(k));
  return hasEconKeyword;
}

/**
 * Generate mock feed for development
 */
export function generateMockFeed(): FeedItem[] {
  const now = new Date();
  return [
    {
      id: 'mock-1',
      source: 'FinancialJuice',
      headline: 'BREAKING: Fed signals potential rate cut in March meeting',
      body: 'Federal Reserve officials indicate openness to rate cuts amid cooling inflation data.',
      symbols: ['ES', 'NQ', 'SPY'],
      tags: ['FED', 'FOMC', 'RATES'],
      isBreaking: true,
      urgency: 'immediate',
      publishedAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
    },
    {
      id: 'mock-2',
      source: 'OSINTSources',
      headline: 'CPI comes in at 2.9% YoY, below expectations of 3.1%',
      body: 'Consumer Price Index shows continued disinflation trend.',
      symbols: ['ES', 'NQ', 'TLT'],
      tags: ['CPI', 'INFLATION'],
      isBreaking: true,
      urgency: 'immediate',
      ivScore: 8.5,
      publishedAt: new Date(now.getTime() - 15 * 60_000).toISOString(),
    },
    {
      id: 'mock-3',
      source: 'FinancialJuice',
      headline: 'NVDA announces new AI chip with 2x performance improvement',
      symbols: ['NVDA', 'AMD', 'INTC'],
      tags: ['TECH', 'AI'],
      isBreaking: false,
      urgency: 'high',
      publishedAt: new Date(now.getTime() - 30 * 60_000).toISOString(),
    },
    {
      id: 'mock-4',
      source: 'OSINTSources',
      headline: 'Oil prices surge on Middle East tensions',
      body: 'Crude oil jumps 3% as geopolitical risks escalate.',
      symbols: ['CL', 'USO', 'XLE'],
      tags: ['OIL', 'COMMODITIES'],
      isBreaking: false,
      urgency: 'normal',
      publishedAt: new Date(now.getTime() - 45 * 60_000).toISOString(),
    },
    {
      id: 'mock-5',
      source: 'FinancialJuice',
      headline: 'Initial jobless claims at 220K vs 215K expected',
      symbols: ['ES', 'NQ'],
      tags: ['JOBS', 'NFP'],
      isBreaking: false,
      urgency: 'normal',
      ivScore: 4.2,
      publishedAt: new Date(now.getTime() - 60 * 60_000).toISOString(),
    },
  ];
}
