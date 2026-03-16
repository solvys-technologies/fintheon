// [claude-code 2026-03-14] Removed MarketWatch RSS poller, XML parsing, singleton. Types + severity kept.
// [claude-code 2026-03-13] Hermes migration: openclawDescription -> hermesDescription in TradeIdeaDetail
/**
 * RiskFlow Alert Types & Severity Classification
 * Types and classification logic used by both frontend context and backend feed mapping.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertSource =
  | 'notion-trade-idea'
  | 'financial-juice'
  | 'insider-wire'
  | 'economic-calendar'
  | 'polymarket'
  | 'kalshi-whale'
  | 'twitter-cli'
  | 'backend';

export interface TradeIdeaDetail {
  title: string;
  ticker: string;
  direction: 'long' | 'short' | 'neutral';
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  potentialRisk?: number;
  potentialProfit?: number;
  riskRewardRatio?: number;
  confidence?: string;
  timeframe?: string;
  sourceAgent?: string;
  hermesDescription?: string;
  notionUrl: string;
}

export interface RiskFlowAlert {
  id: string;
  headline: string;
  summary: string;
  url?: string;
  publishedAt: string;
  source: AlertSource;
  severity: AlertSeverity;
  tags: string[];
  symbols?: string[];
  isBreaking?: boolean;
  tradeIdea?: TradeIdeaDetail;
  /** PriceBrain implied point range (e.g. "±12 pts") */
  pointRange?: number | null;
  /** PriceBrain sentiment direction */
  direction?: 'Bullish' | 'Bearish' | 'Neutral' | null;
  /** PriceBrain cyclical classification */
  cyclical?: 'Cyclical' | 'Counter-cyclical' | 'Neutral' | null;
  /** Instrument from PriceBrain (e.g. "ES", "NQ") */
  instrument?: string | null;
  /** X/Twitter author handle for attribution */
  authorHandle?: string | null;
}

// [claude-code 2026-03-11] Overhauled severity classification — strict contextual matching,
// tiered critical/high/medium/low. Prevents false-positive "critical" on routine commentary.

// ── Severity Classification ────────────────────────────────────────────────────

/** Word-boundary match — prevents "recipe" matching "cpi", etc. */
function wordMatch(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`, 'i').test(text);
}

/** Critical: black swan, systemic crisis, circuit breakers, government shutdown */
const CRITICAL_CHECKS: Array<(t: string) => boolean> = [
  (t) => t.includes('circuit breaker') || t.includes('trading halt'),
  (t) => t.includes('black swan'),
  (t) => t.includes('margin call') && t.includes('liquidation'),
  (t) => t.includes('contagion') || t.includes('systemic'),
  (t) => wordMatch(t, 'crash') && (t.includes('market') || t.includes('stock')),
  (t) => t.includes('emergency') && (t.includes('fed') || t.includes('meeting')),
  (t) => t.includes('government shutdown'),
  (t) => t.includes('debt ceiling') && (t.includes('default') || t.includes('deadline')),
  // V3: credit/liquidity stress
  (t) => t.includes('liquidity crisis') || t.includes('liquidity crunch') || t.includes('funding stress'),
  (t) => t.includes('bank run') || (t.includes('bank') && t.includes('insolvency')),
  (t) => t.includes('repo rate') && t.includes('spike'),
];

/** High: major macro prints with data, Fed decisions, geopolitical escalation */
const HIGH_CHECKS: Array<(t: string) => boolean> = [
  (t) => wordMatch(t, 'fomc') || (wordMatch(t, 'fed') && (t.includes('rate') || t.includes('decision') || t.includes('statement'))),
  (t) => t.includes('rate hike') || t.includes('rate cut'),
  (t) => wordMatch(t, 'cpi') && (t.includes('actual') || t.includes('print') || t.includes('data') || t.includes('report') || t.includes('shock')),
  (t) => wordMatch(t, 'ppi') && (t.includes('actual') || t.includes('print') || t.includes('data') || t.includes('report')),
  (t) => wordMatch(t, 'nfp') || (t.includes('non-farm') && t.includes('payroll')),
  (t) => wordMatch(t, 'gdp') && (t.includes('actual') || t.includes('print') || t.includes('data') || t.includes('growth')),
  (t) => t.includes('recession') && (t.includes('official') || t.includes('confirm') || t.includes('enter')),
  (t) => wordMatch(t, 'war') && (t.includes('declare') || t.includes('escalat') || t.includes('attack') || t.includes('missile')),
  (t) => t.includes('tariff') && (t.includes('new') || t.includes('impose') || t.includes('retaliat') || t.includes('increase')),
  (t) => t.includes('sanctions') && (t.includes('new') || t.includes('impose') || t.includes('expand')),
  (t) => t.includes('bankruptcy') && (t.includes('bank') || t.includes('major') || t.includes('file')),
  (t) => wordMatch(t, 'panic') && (t.includes('sell') || t.includes('market')),
];

/** Medium: earnings beats/misses, secondary data, notable market moves */
const MEDIUM_CHECKS: Array<(t: string) => boolean> = [
  (t) => t.includes('earnings') && (t.includes('beat') || t.includes('miss') || t.includes('revenue') || t.includes('eps')),
  (t) => t.includes('guidance') && (t.includes('lower') || t.includes('raise') || t.includes('cut') || t.includes('above') || t.includes('below')),
  (t) => t.includes('inflation') && (t.includes('rise') || t.includes('fall') || t.includes('data') || t.includes('report')),
  (t) => t.includes('retail sales') && (t.includes('actual') || t.includes('data')),
  (t) => t.includes('unemployment') && (t.includes('rate') || t.includes('claims')),
  (t) => t.includes('jobless claims'),
  (t) => wordMatch(t, 'ipo') && (t.includes('price') || t.includes('launch') || t.includes('debut')),
  (t) => t.includes('merger') || t.includes('acquisition'),
  (t) => t.includes('opec') && (t.includes('cut') || t.includes('output') || t.includes('production')),
  (t) => t.includes('downgrade') && (t.includes('credit') || t.includes('rating') || t.includes('analyst')),
  (t) => t.includes('upgrade') && (t.includes('credit') || t.includes('rating') || t.includes('analyst')),
  (t) => wordMatch(t, 'pce') && (t.includes('actual') || t.includes('data') || t.includes('print')),
  (t) => t.includes('housing') && (t.includes('starts') || t.includes('data') || t.includes('sales')),
  (t) => t.includes('consumer') && t.includes('confidence') && (t.includes('data') || t.includes('index')),
  (t) => t.includes('treasury') && t.includes('auction'),
  (t) => t.includes('yield') && (t.includes('surge') || t.includes('spike') || t.includes('invert')),
  // V3: credit spread and leverage signals
  (t) => t.includes('credit spread') && (t.includes('widen') || t.includes('blow')),
  (t) => t.includes('high yield') && (t.includes('stress') || t.includes('spread')),
  (t) => t.includes('margin debt') && (t.includes('record') || t.includes('surge')),
  (t) => t.includes('leverage') && (t.includes('warning') || t.includes('unwind')),
];

function classifySeverity(text: string): AlertSeverity {
  const lower = text.toLowerCase();
  for (const check of CRITICAL_CHECKS) { if (check(lower)) return 'critical'; }
  for (const check of HIGH_CHECKS) { if (check(lower)) return 'high'; }
  for (const check of MEDIUM_CHECKS) { if (check(lower)) return 'medium'; }
  return 'low';
}

/** Extract tags based on keyword presence (simple substring, capped at 5) */
const TAG_KEYWORDS = [
  'fed', 'fomc', 'cpi', 'ppi', 'nfp', 'gdp', 'pce', 'earnings', 'tariff',
  'recession', 'inflation', 'merger', 'ipo', 'opec', 'sanctions', 'treasury',
];

function extractTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags: string[] = [];
  for (const kw of TAG_KEYWORDS) {
    if (wordMatch(lower, kw) && !tags.includes(kw)) tags.push(kw);
  }
  return tags.slice(0, 5);
}

// ── Exported utilities (used by backend feed mapping) ────────────────────────

export { classifySeverity, extractTags };
