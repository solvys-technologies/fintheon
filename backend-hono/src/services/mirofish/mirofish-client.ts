// [claude-code 2026-03-16] MiroFish local multi-agent debate engine
// Replaces external HTTP client with local simulation via Hermes/OpenRouter

import { generateText } from 'ai';
import { selectModel, createModelClient, type AiModelKey } from '../ai/model-selector.js';
import { isSkillEnabled } from '../../config/feature-flags.js';
import type {
  MiroFishSeed,
  MiroFishReport,
  MiroFishScenario,
  MiroFishRiskCategory,
  MiroFishCategoryScore,
  MiroFishTimePoint,
  MiroFishGeneratedEvent,
  MiroFishAgentResponse,
} from './mirofish-types.js';

const RISK_CATEGORIES: MiroFishRiskCategory[] = [
  'geopolitical', 'political', 'monetary-policy',
  'earnings-corporate', 'market-structure', 'black-swan',
];

const DEBATE_AGENTS = [
  {
    id: 'oracle-sim',
    role: 'macro-strategist' as const,
    weight: 1.0,
    persona: `You are Oracle, the All-Seer. You analyze macro trends — yield curves, central bank policy paths, cross-asset correlations, and prediction market signals. You specialize in identifying regime shifts before they become consensus. Focus on monetary policy risk, geopolitical risk from a macro lens, and structural market risks.`,
  },
  {
    id: 'feucht-sim',
    role: 'risk-manager' as const,
    weight: 1.0,
    persona: `You are Feucht, the risk manager. You assess tail risk, drawdown scenarios, volatility clustering, and position exposure. You are skeptical by nature and focus on what can go wrong. Evaluate black swan probability, market structure fragility, and correlation breakdowns.`,
  },
  {
    id: 'consul-sim',
    role: 'fundamentals' as const,
    weight: 1.0,
    persona: `You are Consul, the fundamentals analyst. You evaluate corporate earnings trends, revenue guidance, mega-cap tech fundamentals, and sector rotation signals. Focus on earnings-corporate risk and how fundamental data creates or resolves political/monetary policy uncertainty.`,
  },
  {
    id: 'herald-sim',
    role: 'sentiment' as const,
    weight: 1.0,
    persona: `You are Herald, the sentiment analyst. You read news flow, social media signals, positioning data, and headline heat. Focus on political risk from a narrative lens, geopolitical escalation signals, and how sentiment drives short-term IV.`,
  },
  {
    id: 'contrarian',
    role: 'contrarian' as const,
    weight: 0.5,
    persona: `You are the Contrarian. Your job is to challenge every thesis the other agents might hold. Find the holes in consensus thinking. Propose alternative scenarios that the market is underpricing. Be constructively skeptical — if everyone is bearish, find the bull case; if everyone is complacent, find the hidden risk.`,
  },
];

const AGENT_SYSTEM_PROMPT = (persona: string) => `${persona}

You are participating in a MiroFish debate simulation. Analyze the provided market context and narrative state, then produce your assessment.

You MUST respond with valid JSON matching this exact schema:
{
  "projectedIVScore": <number 0-10, your overall IV prediction>,
  "regimeShiftProbability": <number 0-1, probability of a major regime change>,
  "categoryScores": [
    { "category": "<geopolitical|political|monetary-policy|earnings-corporate|market-structure|black-swan>", "ivScore": <0-10>, "confidence": <0-1>, "delta": <change from baseline> }
  ],
  "scenarios": [
    { "label": "<scenario name>", "probability": <0-1>, "projectedIVScore": <0-10>, "description": "<1-2 sentences>", "agentConsensus": <0-1> }
  ],
  "generatedEvents": [
    { "title": "<event>", "description": "<brief>", "date": "<ISO date within next 30 days>", "category": "<risk category>", "impactScore": <0-10>, "probability": <0-1> }
  ],
  "reasoning": "<2-3 sentence summary of your analysis>"
}

You MUST include ALL 6 categories in categoryScores. Provide 2-4 scenarios and 1-3 generated events. Return ONLY the JSON object, no markdown fences.`;

export function isMiroFishEnabled(): boolean {
  return isSkillEnabled('mirofish');
}

export async function runDebate(seed: MiroFishSeed): Promise<MiroFishReport> {
  const context = formatSeedContext(seed);
  const startTime = Date.now();

  const results = await Promise.allSettled(
    DEBATE_AGENTS.map(agent => runSimAgent(agent, context)),
  );

  const responses: MiroFishAgentResponse[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      responses.push(result.value);
    } else {
      console.error('[MiroFish] Agent failed:', result.reason);
    }
  }

  if (responses.length === 0) {
    throw new Error('All MiroFish debate agents failed');
  }

  console.log(`[MiroFish] Debate completed: ${responses.length}/${DEBATE_AGENTS.length} agents responded in ${Date.now() - startTime}ms`);
  return aggregateResponses(responses);
}

async function runSimAgent(
  agent: { id: string; role: string; weight: number; persona: string },
  context: string,
): Promise<MiroFishAgentResponse> {
  const selection = selectModel({ taskType: 'reasoning' });
  const model = createModelClient(selection.model as AiModelKey);

  const { text } = await generateText({
    model,
    messages: [
      { role: 'system', content: AGENT_SYSTEM_PROMPT(agent.persona) },
      { role: 'user', content: context },
    ],
    temperature: 0.4,
    maxOutputTokens: 1024,
  });

  const parsed = parseJsonSafe<Omit<MiroFishAgentResponse, 'agentId'>>(text);

  if (!parsed) {
    return buildFallbackResponse(agent.id);
  }

  return {
    agentId: agent.id,
    projectedIVScore: clamp(parsed.projectedIVScore ?? 5, 0, 10),
    regimeShiftProbability: clamp(parsed.regimeShiftProbability ?? 0.1, 0, 1),
    categoryScores: normalizeCategories(parsed.categoryScores),
    scenarios: (parsed.scenarios ?? []).slice(0, 4),
    generatedEvents: (parsed.generatedEvents ?? []).map(e => ({
      ...e,
      id: `${agent.id}-${crypto.randomUUID().slice(0, 8)}`,
      isAiGenerated: true as const,
    })),
    reasoning: parsed.reasoning ?? '',
  };
}

function aggregateResponses(responses: MiroFishAgentResponse[]): MiroFishReport {
  const agentWeights = new Map(DEBATE_AGENTS.map(a => [a.id, a.weight]));
  let totalWeight = 0;
  let weightedIV = 0;
  let weightedRegime = 0;

  for (const r of responses) {
    const w = agentWeights.get(r.agentId) ?? 1.0;
    totalWeight += w;
    weightedIV += r.projectedIVScore * w;
    weightedRegime += r.regimeShiftProbability * w;
  }

  const compositeIV = weightedIV / totalWeight;
  const compositeRegime = weightedRegime / totalWeight;

  // Aggregate per-category scores
  const categoryScores = aggregateCategoryScores(responses, agentWeights);

  // Merge scenarios — deduplicate by similarity, pick top ones
  const scenarios = mergeScenarios(responses);

  // Collect all generated events
  const generatedEvents = deduplicateEvents(responses);

  // Generate synthetic time series
  const timeSeries = generateTimeSeries(categoryScores, compositeIV, 30);

  // Build agent votes
  const agentVotes = responses.map(r => ({
    agentId: r.agentId,
    position: r.projectedIVScore >= 6 ? 'high-vol' : r.projectedIVScore >= 4 ? 'neutral' : 'low-vol',
    confidence: Math.max(...r.categoryScores.map(c => c.confidence), 0.5),
  }));

  return {
    simulationId: crypto.randomUUID(),
    scenarios,
    regimeShiftProbability: Number(compositeRegime.toFixed(3)),
    nextSessionProjection: Number(compositeIV.toFixed(1)),
    confidence: Number((categoryScores.reduce((s, c) => s + c.confidence, 0) / categoryScores.length).toFixed(2)),
    agentVotes,
    categoryScores,
    timeSeries,
    generatedEvents,
    generatedAt: new Date().toISOString(),
  };
}

function aggregateCategoryScores(
  responses: MiroFishAgentResponse[],
  weights: Map<string, number>,
): MiroFishCategoryScore[] {
  return RISK_CATEGORIES.map(cat => {
    let totalW = 0;
    let wScore = 0;
    let wConf = 0;
    let wDelta = 0;

    for (const r of responses) {
      const w = weights.get(r.agentId) ?? 1.0;
      const cs = r.categoryScores.find(c => c.category === cat);
      if (cs) {
        totalW += w;
        wScore += cs.ivScore * w;
        wConf += cs.confidence * w;
        wDelta += cs.delta * w;
      }
    }

    if (totalW === 0) {
      return { category: cat, ivScore: 5, confidence: 0.5, delta: 0 };
    }

    return {
      category: cat,
      ivScore: Number((wScore / totalW).toFixed(1)),
      confidence: Number((wConf / totalW).toFixed(2)),
      delta: Number((wDelta / totalW).toFixed(2)),
    };
  });
}

function mergeScenarios(responses: MiroFishAgentResponse[]): MiroFishScenario[] {
  const all: MiroFishScenario[] = [];
  for (const r of responses) {
    for (const s of r.scenarios) {
      all.push({
        ...s,
        projectedIVScore: clamp(s.projectedIVScore ?? 5, 0, 10),
        probability: clamp(s.probability ?? 0.2, 0, 1),
        agentConsensus: clamp(s.agentConsensus ?? 0.5, 0, 1),
      });
    }
  }

  // Group by label similarity and average
  const grouped = new Map<string, MiroFishScenario[]>();
  for (const s of all) {
    const key = s.label.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);
    const group = grouped.get(key) ?? [];
    group.push(s);
    grouped.set(key, group);
  }

  const merged: MiroFishScenario[] = [];
  for (const [, group] of grouped) {
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    merged.push({
      label: group[0].label,
      probability: Number(avg(group.map(g => g.probability)).toFixed(2)),
      projectedIVScore: Number(avg(group.map(g => g.projectedIVScore)).toFixed(1)),
      description: group[0].description,
      agentConsensus: Number((group.length / DEBATE_AGENTS.length).toFixed(2)),
    });
  }

  // Normalize probabilities and sort
  const total = merged.reduce((s, m) => s + m.probability, 0);
  for (const m of merged) m.probability = Number((m.probability / (total || 1)).toFixed(2));
  merged.sort((a, b) => b.probability - a.probability);

  return merged.slice(0, 6);
}

function deduplicateEvents(responses: MiroFishAgentResponse[]): MiroFishGeneratedEvent[] {
  const seen = new Set<string>();
  const events: MiroFishGeneratedEvent[] = [];

  for (const r of responses) {
    for (const e of r.generatedEvents) {
      const key = e.title.toLowerCase().replace(/[^a-z]/g, '').slice(0, 20);
      if (!seen.has(key)) {
        seen.add(key);
        events.push(e);
      }
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

function generateTimeSeries(
  categoryScores: MiroFishCategoryScore[],
  compositeScore: number,
  days: number,
): MiroFishTimePoint[] {
  const points: MiroFishTimePoint[] = [];
  const now = new Date();
  const meanTarget = 3.5;

  for (let d = 0; d <= days; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const decay = d / days;

    const categories = {} as Record<MiroFishRiskCategory, number>;
    let catSum = 0;

    for (const cs of categoryScores) {
      // Mean-revert + deterministic wobble per category
      const wobble = Math.sin(d * 0.7 + hashCode(cs.category) * 0.1) * 0.4;
      const reverted = cs.ivScore + (meanTarget - cs.ivScore) * decay * 0.3 + wobble;
      const val = clamp(Number(reverted.toFixed(1)), 0, 10);
      categories[cs.category] = val;
      catSum += val;
    }

    const composite = d === 0
      ? compositeScore
      : Number((catSum / RISK_CATEGORIES.length).toFixed(1));

    points.push({
      dayOffset: d,
      date: date.toISOString().slice(0, 10),
      composite,
      categories,
    });
  }

  return points;
}

function formatSeedContext(seed: MiroFishSeed): string {
  const sections: string[] = ['=== MIROFISH SIMULATION CONTEXT ==='];

  if (seed.entities.length > 0) {
    sections.push('\n--- NARRATIVE ENTITIES ---');
    for (const e of seed.entities) {
      sections.push(`[${e.type.toUpperCase()}] ${e.label}`);
      if (e.properties.category) sections.push(`  Category: ${e.properties.category}`);
      if (e.properties.directionBias) sections.push(`  Bias: ${e.properties.directionBias}`);
      if (e.properties.healthScore) sections.push(`  Health: ${e.properties.healthScore}/100`);
      if (e.properties.sentiment) sections.push(`  Sentiment: ${e.properties.sentiment}`);
      if (e.properties.severity) sections.push(`  Severity: ${e.properties.severity}`);
    }
  }

  if (seed.relationships.length > 0) {
    sections.push('\n--- RELATIONSHIPS ---');
    for (const r of seed.relationships) {
      sections.push(`${r.fromId} --[${r.type} w=${r.weight}]--> ${r.toId}`);
    }
  }

  const ctx = seed.environmentalContext;
  if (Object.keys(ctx).length > 0) {
    sections.push('\n--- LIVE MARKET ENVIRONMENT ---');
    if (ctx.vixLevel) sections.push(`VIX Level: ${ctx.vixLevel}`);
    if (ctx.gexNet) sections.push(`GEX Net Exposure: ${ctx.gexNet}`);
    const macro = ctx.macro as Record<string, number> | undefined;
    if (macro && Object.keys(macro).length > 0) {
      sections.push('FRED Macro Indicators:');
      if (macro.hyOasSpread != null) sections.push(`  HY OAS Spread: ${macro.hyOasSpread.toFixed(2)}% (credit stress — >5% = distress)`);
      if (macro.yieldCurve2s10s != null) sections.push(`  10Y-2Y Yield Curve: ${macro.yieldCurve2s10s.toFixed(2)}% (${macro.yieldCurve2s10s < 0 ? 'INVERTED — recession signal' : 'normal'})`);
      if (macro.yieldCurve3m10y != null) sections.push(`  10Y-3M Yield Curve: ${macro.yieldCurve3m10y.toFixed(2)}% (${macro.yieldCurve3m10y < 0 ? 'INVERTED' : 'normal'})`);
      if (macro.tedSpread != null) sections.push(`  TED Spread: ${macro.tedSpread.toFixed(2)}% (interbank stress — >0.5% = elevated)`);
      if (macro.fedFundsRate != null) sections.push(`  Fed Funds Rate: ${macro.fedFundsRate.toFixed(2)}%`);
    }
  }

  // Include Federal Reserve debate board signal if available
  const fedSignal = ctx.fedReserveSignal as { monetaryPolicySignal?: number; rateDecision?: string; consensusStrength?: number; forwardGuidanceSignal?: string; dissentCount?: number; medianDotPlot?: number; regimeShiftProbability?: number } | undefined;
  if (fedSignal?.monetaryPolicySignal != null) {
    sections.push('\n--- FEDERAL RESERVE BOARD SIGNAL ---');
    sections.push(`Monetary Policy Signal: ${fedSignal.monetaryPolicySignal}/10`);
    sections.push(`Rate Decision: ${fedSignal.rateDecision}`);
    sections.push(`Consensus Strength: ${((fedSignal.consensusStrength ?? 0) * 100).toFixed(0)}%`);
    sections.push(`Forward Guidance: ${fedSignal.forwardGuidanceSignal}`);
    sections.push(`Dissent Count: ${fedSignal.dissentCount}`);
    sections.push(`Median Dot Plot: ${fedSignal.medianDotPlot}%`);
    sections.push(`Regime Shift Probability (monetary): ${((fedSignal.regimeShiftProbability ?? 0) * 100).toFixed(0)}%`);
    sections.push('NOTE: This signal comes from the FOMC deliberation simulation. Weight it heavily for monetary-policy category scoring.');
  }

  sections.push('\n--- TASK ---');
  sections.push('Analyze the above context. For each of the 6 risk categories (geopolitical, political, monetary-policy, earnings-corporate, market-structure, black-swan), provide an IV score (0-10), confidence (0-1), and delta from current baseline.');
  sections.push('Also provide 2-4 scenarios with probabilities, and 1-3 upcoming events you predict within the next 30 days.');

  return sections.join('\n');
}

function buildFallbackResponse(agentId: string): MiroFishAgentResponse {
  return {
    agentId,
    projectedIVScore: 5,
    regimeShiftProbability: 0.1,
    categoryScores: RISK_CATEGORIES.map(cat => ({
      category: cat, ivScore: 5, confidence: 0.3, delta: 0,
    })),
    scenarios: [{
      label: 'Continuation', probability: 0.6,
      projectedIVScore: 5, description: 'Current regime persists.',
      agentConsensus: 0.5,
    }],
    generatedEvents: [],
    reasoning: 'Fallback response — agent parse failed.',
  };
}

function normalizeCategories(scores: MiroFishCategoryScore[] | undefined): MiroFishCategoryScore[] {
  if (!scores || scores.length === 0) {
    return RISK_CATEGORIES.map(cat => ({ category: cat, ivScore: 5, confidence: 0.5, delta: 0 }));
  }
  const present = new Set(scores.map(s => s.category));
  const result = [...scores];
  for (const cat of RISK_CATEGORIES) {
    if (!present.has(cat)) {
      result.push({ category: cat, ivScore: 5, confidence: 0.3, delta: 0 });
    }
  }
  return result;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}

function parseJsonSafe<T>(text: string): T | null {
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
