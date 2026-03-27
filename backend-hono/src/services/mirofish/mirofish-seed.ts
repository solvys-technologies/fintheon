// [claude-code 2026-03-16] Convert Fintheon narrative state → MiroFish seed format

import type {
  MiroFishSeed,
  MiroFishEntity,
  MiroFishRelationship,
  MiroFishAgent,
} from './mirofish-types.js';

interface NarrativeLaneInput {
  id: string;
  title: string;
  instruments: string[];
  directionBias: string;
  category: string;
  status: string;
  healthScore: number;
  dateRange: { start: string; end: string | null };
}

interface CatalystCardInput {
  id: string;
  title: string;
  description: string;
  date: string;
  sentiment: string;
  severity: string;
  narrativeIds: string[];
}

interface RopeInput {
  id: string;
  fromId: string;
  toId: string;
  polarity: string;
  weight: number;
}

interface EconPrintSnapshot {
  eventName: string;
  actual: number | null;
  forecast: number | null;
  surprise: number | null;
  direction: 'beat' | 'miss' | 'inline' | null;
  ivScore: number | null;
  printedAt: string | null;
}

interface ContextSnapshot {
  vixLevel?: number;
  gexNet?: number;
  macroIndicators?: Record<string, number>;
  econPrintHistory?: EconPrintSnapshot[];
}

/** Map narrative categories to MiroFish agent roles */
const CATEGORY_TO_AGENT_ROLE: Record<string, MiroFishAgent['role']> = {
  monetary: 'macro-strategist',
  macroeconomic: 'macro-strategist',
  'market-structure': 'sentiment-analyst',
  geopolitical: 'geopolitical-analyst',
  earnings: 'earnings-analyst',
  'black-swan': 'risk-manager',
  'supply-chain': 'geopolitical-analyst',
};

const AGENT_PERSONAS: Record<MiroFishAgent['role'], { persona: string }> = {
  'macro-strategist': { persona: 'Senior macro strategist focused on monetary policy and economic cycles' },
  'sentiment-analyst': { persona: 'Market microstructure specialist tracking positioning and flow' },
  'geopolitical-analyst': { persona: 'Geopolitical risk analyst covering supply chains and trade policy' },
  'earnings-analyst': { persona: 'Corporate earnings analyst tracking sector rotations' },
  'risk-manager': { persona: 'Tail risk manager monitoring systemic threats and black swans' },
  'contrarian': { persona: 'Contrarian agent challenging consensus theses' },
  'fundamentals': { persona: 'Fundamental analyst evaluating corporate earnings and sector rotation' },
  'sentiment': { persona: 'Sentiment analyst reading news flow and social signals' },
};

function buildEntities(lanes: NarrativeLaneInput[], catalysts: CatalystCardInput[]): MiroFishEntity[] {
  const entities: MiroFishEntity[] = [];

  for (const lane of lanes) {
    entities.push({
      id: `narrative-${lane.id}`,
      type: 'narrative',
      label: lane.title,
      properties: {
        category: lane.category,
        directionBias: lane.directionBias,
        status: lane.status,
        healthScore: lane.healthScore,
        instruments: lane.instruments,
        dateRange: lane.dateRange,
      },
    });
  }

  for (const cat of catalysts) {
    entities.push({
      id: `event-${cat.id}`,
      type: 'event',
      label: cat.title,
      properties: {
        description: cat.description,
        date: cat.date,
        sentiment: cat.sentiment,
        severity: cat.severity,
        narrativeIds: cat.narrativeIds,
      },
    });
  }

  return entities;
}

function buildRelationships(ropes: RopeInput[]): MiroFishRelationship[] {
  return ropes.map(rope => ({
    fromId: rope.fromId,
    toId: rope.toId,
    type: rope.polarity === 'reinforcing' ? 'reinforces' as const : 'contradicts' as const,
    weight: rope.weight,
  }));
}

function buildAgents(lanes: NarrativeLaneInput[]): MiroFishAgent[] {
  const roleSet = new Set<MiroFishAgent['role']>();
  const roleCats = new Map<MiroFishAgent['role'], string[]>();

  for (const lane of lanes) {
    const role = CATEGORY_TO_AGENT_ROLE[lane.category] ?? 'macro-strategist';
    roleSet.add(role);
    const cats = roleCats.get(role) ?? [];
    cats.push(lane.category);
    roleCats.set(role, cats);
  }

  return Array.from(roleSet).map(role => ({
    id: `agent-${role}`,
    persona: AGENT_PERSONAS[role].persona,
    role,
    narrativeCategories: [...new Set(roleCats.get(role) ?? [])],
  }));
}

export function convertNarrativeToSeed(
  lanes: NarrativeLaneInput[],
  catalysts: CatalystCardInput[],
  ropes: RopeInput[],
  context?: ContextSnapshot,
): MiroFishSeed {
  const environmentalContext: Record<string, unknown> = {};

  if (context?.vixLevel != null) environmentalContext.vixLevel = context.vixLevel;
  if (context?.gexNet != null) environmentalContext.gexNet = context.gexNet;
  if (context?.macroIndicators) environmentalContext.macro = context.macroIndicators;
  if (context?.econPrintHistory?.length) {
    // Aggregate beat/miss patterns for agent debate context
    const beats = context.econPrintHistory.filter(p => p.direction === 'beat').length;
    const misses = context.econPrintHistory.filter(p => p.direction === 'miss').length;
    const avgSurprise = context.econPrintHistory
      .filter(p => p.surprise != null)
      .reduce((sum, p) => sum + Math.abs(p.surprise!), 0) / Math.max(1, context.econPrintHistory.filter(p => p.surprise != null).length);
    const avgIV = context.econPrintHistory
      .filter(p => p.ivScore != null)
      .reduce((sum, p) => sum + p.ivScore!, 0) / Math.max(1, context.econPrintHistory.filter(p => p.ivScore != null).length);

    environmentalContext.econPrintStats = {
      totalPrints: context.econPrintHistory.length,
      beats,
      misses,
      inlines: context.econPrintHistory.length - beats - misses,
      avgAbsSurprise: Math.round(avgSurprise * 100) / 100,
      avgIVScore: Math.round(avgIV * 100) / 100,
      beatRatio: Math.round((beats / Math.max(1, context.econPrintHistory.length)) * 100) / 100,
      recentPrints: context.econPrintHistory.slice(0, 5).map(p => ({
        event: p.eventName,
        direction: p.direction,
        surprise: p.surprise,
        iv: p.ivScore,
      })),
    };
  }

  return {
    entities: buildEntities(lanes, catalysts),
    relationships: buildRelationships(ropes),
    environmentalContext,
    agents: buildAgents(lanes),
    timestamp: new Date().toISOString(),
  };
}
