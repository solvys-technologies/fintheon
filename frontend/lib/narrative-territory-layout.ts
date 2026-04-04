// [claude-code 2026-04-04] TERRITORY_LAYOUT uses { x, y, r } (circle radii), 3-tier semantic zoom (macro/narratives/themes)
import type { CatalystCard } from './narrative-types';

export interface NarrativeThread {
  slug: string;
  title: string;
  shortTitle: string;
  color: string;
}

// [claude-code 2026-04-04] Color scheme: Yellow=monetary, Purple=structural, Teal=market/secular, Red=geopolitical
export const NARRATIVE_THREADS: NarrativeThread[] = [
  { slug: 'middle-east-conflict', title: 'Middle Eastern Conflict', color: '#EF4444', shortTitle: 'Middle East' },       // Red — geopolitical conflict
  { slug: 'liquidity-credit-contraction', title: 'Liquidity & Credit', color: '#A855F7', shortTitle: 'Liquidity' },      // Purple — structural
  { slug: 'ai-singularity', title: 'The Singularity', color: '#14B8A6', shortTitle: 'AI' },                              // Teal — market/secular
  { slug: 'usd-jpy-carry-trade', title: 'USD-JPY Carry Trade', color: '#A855F7', shortTitle: 'Carry Trade' },            // Purple — structural
  { slug: 'trade-war', title: 'Trade War', color: '#EF4444', shortTitle: 'Trade War' },                                  // Red — geopolitical
  { slug: 'us-china-relations', title: 'US-China Relations', color: '#A855F7', shortTitle: 'US-China' },                 // Purple — structural
  { slug: 'rate-cut-cycle', title: 'Rate Cut Cycle', color: '#EAB308', shortTitle: 'Rate Cuts' },                        // Yellow — monetary policy
  { slug: 'trump-presidency', title: 'Trump Presidency', color: '#EF4444', shortTitle: 'Trump' },                        // Red — geopolitical
  { slug: 'price-stability', title: 'Price Stability', color: '#EAB308', shortTitle: 'Inflation' },                      // Yellow — monetary policy
  { slug: 'maximum-employment', title: 'Max Employment', color: '#EAB308', shortTitle: 'Employment' },                   // Yellow — monetary policy
];

export const THREAD_MAP = Object.fromEntries(
  NARRATIVE_THREADS.map((thread) => [thread.slug, thread]),
) as Record<string, NarrativeThread>;

const VALID_SLUGS = new Set(NARRATIVE_THREADS.map((thread) => thread.slug));

const COL = 420;
const ROW = 340;
const GAP = 20;

export const TERRITORY_LAYOUT: Record<string, { x: number; y: number; r: number }> = {
  'middle-east-conflict': { x: 0, y: 0, r: Math.max(COL * 1.4, ROW * 1.1) / 2 },
  'trump-presidency': { x: COL * 1.4 + GAP, y: ROW * 0.3, r: Math.max(COL * 1.2, ROW * 0.9) / 2 },
  'rate-cut-cycle': { x: COL * 2.6 + GAP * 2, y: 0, r: Math.max(COL * 1.5, ROW * 1.1) / 2 },
  'price-stability': { x: COL * 2.2 + GAP, y: ROW * 1.1 + GAP, r: Math.max(COL * 1.2, ROW * 0.9) / 2 },
  'maximum-employment': { x: COL * 3.4 + GAP * 2, y: ROW * 1.1 + GAP, r: Math.max(COL * 0.8, ROW * 0.9) / 2 },
  'trade-war': { x: 0, y: ROW * 1.2 + GAP, r: Math.max(COL * 1.2, ROW * 1.3) / 2 },
  'usd-jpy-carry-trade': { x: COL * 1.5 + GAP, y: ROW * 2.1 + GAP * 2, r: Math.max(COL * 1.0, ROW * 0.9) / 2 },
  'liquidity-credit-contraction': { x: COL * 2.8 + GAP * 2, y: ROW * 2.1 + GAP * 2, r: Math.max(COL * 1.0, ROW * 0.9) / 2 },
  'us-china-relations': { x: COL * 0.8, y: ROW * 2.7 + GAP * 2, r: Math.max(COL * 1.0, ROW * 0.9) / 2 },
  'ai-singularity': { x: 0, y: ROW * 3.2 + GAP * 3, r: Math.max(COL * 1.0, ROW * 0.9) / 2 },
};

export const HUB_POSITIONS = Object.fromEntries(
  Object.entries(TERRITORY_LAYOUT).map(([slug, territory]) => [
    slug,
    {
      x: territory.x + territory.r,
      y: territory.y + territory.r,
    },
  ]),
) as Record<string, { x: number; y: number }>;

export const SEVERITY_COLORS: Record<'high' | 'medium' | 'low', string> = {
  high: '#EF4444',
  medium: '#c79f4a',
  low: '#6B7280',
};

// [claude-code 2026-04-04] Green ropes, 90% transparent, with teal shimmer
export const CROSS_NARRATIVE_ROPE = '#22C55E';

export type SemanticNarrativeView = 'macro' | 'narratives' | 'themes';

export function getSemanticZoom(zoom: number): SemanticNarrativeView {
  if (zoom >= 0.45) return 'themes';
  if (zoom >= 0.15) return 'narratives';
  return 'macro';
}

export function safeSlug(raw: string | undefined | null): string {
  if (!raw) return 'rate-cut-cycle';
  if (VALID_SLUGS.has(raw)) return raw;
  const slugified = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (VALID_SLUGS.has(slugified)) return slugified;
  return 'rate-cut-cycle';
}

export function formatDateShort(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  });
}

export function getMonthKey(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return 'unknown';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function deriveIvScore(card: CatalystCard): number {
  const base = card.severity === 'high' ? 7.5 : card.severity === 'medium' ? 5.0 : 2.5;
  const catBoost: Record<string, number> = {
    geopolitical: 1.2,
    monetary: 0.8,
    macroeconomic: 0.5,
    earnings: 0.3,
    'market-structure': 1.0,
    'supply-chain': 0.6,
  };
  return Math.min(10, base + (catBoost[card.category ?? ''] ?? 0));
}

export function deriveCyclicality(card: CatalystCard): 'cyclical' | 'counter-cyclical' {
  const counterTags = new Set([
    'geopolitical',
    'war',
    'conflict',
    'tariff',
    'sanctions',
    'trade-war',
    'escalation',
    'black-swan',
    'supply-shock',
  ]);

  if (card.category === 'geopolitical' || card.category === 'supply-chain') {
    return 'counter-cyclical';
  }

  if (card.tags?.some((tag) => counterTags.has(tag))) {
    return 'counter-cyclical';
  }

  return 'cyclical';
}
