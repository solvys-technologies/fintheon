// [claude-code 2026-03-28] S5-T3: Auto-seed pipeline — historical fixture + live RiskFlow import
import seedEvents from '../data/narrative-seed-events.json';
import type { CatalystCard, NarrativeCategory, CatalystSeverity, CatalystSentiment } from './narrative-types';
import type { RiskFlowAlert } from './riskflow-feed';

// Bump version when seed data changes to re-seed existing users
const SEED_FLAG = 'fintheon:narrative-seeded:v8';

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
    narrativeIds: [],
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

/**
 * Import live RiskFlow items as editable copies.
 * Only imports items not already in the store (by riskflowItemId).
 */
export function importRiskFlowItems(
  alerts: RiskFlowAlert[],
  existingIds: Set<string>,
): CatalystCard[] {
  const now = new Date().toISOString();
  return alerts
    .filter(a => !existingIds.has(a.id))
    .slice(0, 30)
    .map(a => ({
      id: `rf-${a.id}`,
      title: a.headline,
      description: a.summary ?? '',
      date: a.publishedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      category: mapRiskType(a.riskType) ?? 'macroeconomic',
      severity: mapSeverity(a.severity),
      sentiment: (a.direction === 'Bullish' ? 'bullish' : 'bearish') as CatalystSentiment,
      source: 'riskflow-import' as const,
      narrativeIds: [],
      isGhost: false,
      templateType: null,
      position: null,
      tags: a.tags ?? [],
      riskflowItemId: a.id,
      directionBias: a.direction === 'Bullish' ? 'bullish' : a.direction === 'Bearish' ? 'bearish' : 'neutral',
      status: 'active' as const,
      dateRange: { start: a.publishedAt?.slice(0, 10) ?? '', end: null },
      drillDepth: 0,
      createdAt: now,
      updatedAt: now,
    }));
}
