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

/** Per-item scoring breakdown showing how each factor contributed */
export interface SubScoreBreakdown {
  eventWeight: number;
  timing: number;
  deviation: number;
  momentum: number;
  vixContext: number;
  vixMultiplier: number;
  regimeMultiplier?: number;
  regimeName?: string;
  commentatorMultiplier?: number;
  speaker?: string | null;
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
  /** Per-item sub-score breakdown (VIX-weighted) */
  subScores?: SubScoreBreakdown | null;
  /** Risk classification category */
  riskType?: 'Macro' | 'Geopolitical' | 'Earnings' | 'Technical' | 'Credit' | 'Liquidity' | 'Commentary' | null;
  /** Agent-generated analytical note */
  agentNote?: string | null;
  /** Timestamp when agentNote was generated */
  agentNoteGeneratedAt?: string | null;
  /** Structured economic data for econ prints */
  econData?: {
    actual?: number | null;
    forecast?: number | null;
    previous?: number | null;
    beatMiss?: 'beat' | 'miss' | 'inline' | null;
    surprisePercent?: number | null;
  } | null;
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

// ── Shared Direction Inference ────────────────────────────────────────────────

const BULLISH_KW = ['surge', 'rally', 'rise', 'gain', 'jump', 'soar', 'bull', 'record high', 'beat', 'above', 'upgrade', 'boom', 'positive', 'strong', 'up '];
const BEARISH_KW = ['drop', 'fall', 'crash', 'plunge', 'decline', 'sink', 'bear', 'miss', 'below', 'downgrade', 'slump', 'negative', 'fear', 'risk', 'warn', 'cut', 'sell', 'weak', 'down '];

/** Infer Bullish/Bearish from alert data or headline keywords */
export function inferDirection(alert: RiskFlowAlert): 'Bullish' | 'Bearish' {
  if (alert.direction === 'Bullish' || alert.direction === 'Bearish') return alert.direction;
  if (alert.tradeIdea) return alert.tradeIdea.direction === 'long' ? 'Bullish' : 'Bearish';
  const lower = (alert.headline + ' ' + (alert.summary ?? '')).toLowerCase();
  let b = 0, s = 0;
  for (const kw of BULLISH_KW) if (lower.includes(kw)) b++;
  for (const kw of BEARISH_KW) if (lower.includes(kw)) s++;
  return b >= s ? 'Bullish' : 'Bearish';
}

// ── Cyclical Inference ───────────────────────────────────────────────────────

const CYCLICAL_KW = ['gdp', 'employment', 'consumer spending', 'retail sales', 'manufacturing', 'housing', 'industrial', 'earnings', 'revenue', 'ipo', 'merger', 'acquisition', 'capex'];
const COUNTER_CYCLICAL_KW = ['treasury', 'gold', 'vix', 'defensive', 'utilities', 'healthcare', 'staples', 'bond', 'yield inversion', 'recession', 'safe haven', 'flight to safety'];

function inferCyclical(alert: RiskFlowAlert): 'Cyclical' | 'Counter-cyclical' | 'Neutral' {
  if (alert.cyclical && alert.cyclical !== 'Neutral') return alert.cyclical;
  const lower = (alert.headline + ' ' + (alert.summary ?? '')).toLowerCase();
  let cyc = 0, ctr = 0;
  for (const kw of CYCLICAL_KW) if (lower.includes(kw)) cyc++;
  for (const kw of COUNTER_CYCLICAL_KW) if (lower.includes(kw)) ctr++;
  if (cyc > ctr) return 'Cyclical';
  if (ctr > cyc) return 'Counter-cyclical';
  return 'Neutral';
}

// ── Ensure Scoring on Every Item ─────────────────────────────────────────────

/** Severity-to-beta multiplier for estimating implied points */
const SEVERITY_POINT_ESTIMATE: Record<AlertSeverity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
};

/**
 * Ensures every RiskFlowAlert has pointRange, direction, and cyclical filled in.
 * If pointRange is missing, estimates from severity + instrument beta.
 * Mutates in place for performance but also returns the array.
 */
export function ensureScoring(alerts: RiskFlowAlert[], selectedInstrument?: string): RiskFlowAlert[] {
  for (const alert of alerts) {
    // Direction — always fill
    if (!alert.direction || alert.direction === 'Neutral') {
      alert.direction = inferDirection(alert);
    }
    // Cyclical — always fill
    if (!alert.cyclical || alert.cyclical === 'Neutral') {
      alert.cyclical = inferCyclical(alert);
    }
    // Instrument — always use user's selected instrument
    if (selectedInstrument) {
      alert.instrument = selectedInstrument;
    }
    // Point range — estimate from severity if missing
    if (alert.pointRange == null || alert.pointRange === 0) {
      alert.pointRange = SEVERITY_POINT_ESTIMATE[alert.severity] ?? 3;
    }
  }
  return alerts;
}

// ── False-BREAKING Headline Filter ───────────────────────────────────────────

const FINANCIAL_TERMS = [
  'spx', 'spy', 'nq', 'es', 'nqs', 'ym', 'rty', 'vix', 'dxy',
  'futures', 'equities', 'equity', 'stock', 'stocks', 'index', 'indices',
  'fed', 'fomc', 'cpi', 'ppi', 'nfp', 'gdp', 'pce', 'treasury',
  'earnings', 'revenue', 'eps', 'guidance', 'dividend',
  'rate', 'yield', 'bond', 'bonds', 'inflation', 'recession',
  'tariff', 'trade war', 'sanctions', 'opec', 'oil', 'crude',
  'gold', 'silver', 'bitcoin', 'btc', 'eth', 'crypto',
  'dollar', 'euro', 'yen', 'forex', 'fx',
  'market', 'markets', 'wall street', 'nasdaq', 'dow',
  's&p', 'russell', 'sector', 'rally', 'selloff', 'sell-off',
  'bull', 'bear', 'short', 'long', 'hedge',
  'ipo', 'merger', 'acquisition', 'buyback', 'sec',
  'bank', 'banking', 'credit', 'liquidity', 'default',
];

const GEOPOLITICAL_TERMS = [
  'iran', 'israel', 'russia', 'ukraine', 'china', 'taiwan',
  'war', 'ceasefire', 'sanctions', 'strike', 'missile', 'nato',
  'military', 'troops', 'invasion', 'nuclear', 'embargo', 'blockade',
  'strait', 'hormuz', 'conflict', 'escalation', 'peace', 'treaty',
  'north korea', 'houthi', 'hezbollah', 'hamas', 'attack', 'drone',
];

/**
 * Downgrade severity of items with BREAKING/emoji prefixes that aren't about
 * financial topics. Prevents celebrity news, sports, etc. from being 'critical'.
 */
export function downgradeNonFinancialBreaking(alerts: RiskFlowAlert[]): RiskFlowAlert[] {
  for (const alert of alerts) {
    const hasBreaking = alert.isBreaking || /breaking|🚨|⚠️|🔴/i.test(alert.headline);
    if (!hasBreaking) continue;
    // Already low — skip
    if (alert.severity === 'low') continue;
    const lower = (alert.headline + ' ' + (alert.summary ?? '')).toLowerCase();
    const hasFinancialTerm = FINANCIAL_TERMS.some((term) => wordMatch(lower, term) || lower.includes(term));
    const hasGeopoliticalTerm = GEOPOLITICAL_TERMS.some((term) => lower.includes(term));
    if (!hasFinancialTerm && !hasGeopoliticalTerm) {
      alert.severity = 'low';
    }
  }
  return alerts;
}

// ── Exported utilities (used by backend feed mapping) ────────────────────────

export { classifySeverity, extractTags };
