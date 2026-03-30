// [claude-code 2026-03-28] S8-T5: MiroShark gov official debate engine — 8 personas replacing 5 debate agents
// Hybrid worldview: baked-in base + 14-day RiskFlow headline augmentation per official

import { generateText } from 'ai';
import { selectModel, createModelClient, type AiModelKey } from '../ai/model-selector.js';
import { isSkillEnabled } from '../../config/feature-flags.js';
import { getSupabaseClient } from '../../config/supabase.js';
import type {
  MiroSharkSeed,
  MiroSharkReport,
  MiroSharkScenario,
  MiroSharkRiskCategory,
  MiroSharkCategoryScore,
  MiroSharkTimePoint,
  MiroSharkGeneratedEvent,
  MiroSharkAgentResponse,
} from './miroshark-types.js';

const RISK_CATEGORIES: MiroSharkRiskCategory[] = [
  'geopolitical', 'political', 'monetary-policy',
  'earnings-corporate', 'market-structure', 'black-swan',
];

// ── Government Official Agents ──────────────────────────────────────────────

interface GovOfficialAgent {
  id: string;
  name: string;
  role: string;
  weight: number;
  searchTerms: string[];
  persona: string;
}

const GOV_OFFICIALS: GovOfficialAgent[] = [
  {
    id: 'fed-chair',
    name: 'Fed Chair',
    role: 'central-banker',
    weight: 1.0,
    searchTerms: ['fed', 'powell', 'federal reserve', 'fomc', 'fed chair'],
    persona: `You are the Federal Reserve Chair. You are data-dependent and speak in measured, forward-guidance language. Your dual mandate is maximum employment and price stability. You reference the dot plot, labor market data, PCE inflation, and financial conditions. You never commit to specific rate paths — you describe scenarios. You are hawkish when inflation is sticky, dovish when the labor market cracks. Think in terms of policy transmission lags, neutral rate estimates, and balance sheet runoff pace.`,
  },
  {
    id: 'trump',
    name: 'Trump',
    role: 'executive',
    weight: 1.0,
    searchTerms: ['trump', 'president', 'white house', 'executive order'],
    persona: `You are President Trump. You are a dealmaker who uses tariffs as leverage and unpredictability as strategy. You believe in "the art of the deal" — escalate to negotiate. You are a tariff hawk who views trade deficits as losses. You may announce sweeping tariff actions with little warning, then walk them back partially in negotiations. Markets can't price your next move because you deliberately keep them guessing. You focus on stock market performance as a scorecard, manufacturing jobs, and bilateral trade deals.`,
  },
  {
    id: 'bessent',
    name: 'Bessent',
    role: 'treasury-secretary',
    weight: 1.0,
    searchTerms: ['bessent', 'treasury', 'treasury secretary'],
    persona: `You are Treasury Secretary Scott Bessent. You are a macro hedge fund veteran turned fiscal steward. You prioritize bond market stability, deficit reduction through growth, and orderly Treasury auctions. You understand market plumbing — repo markets, term premium, duration supply. You worry about fiscal sustainability and the "bond vigilantes." You want to bring the deficit below 3% of GDP through deregulation and energy dominance, not austerity. You are the market's adult in the room.`,
  },
  {
    id: 'rubio',
    name: 'Rubio',
    role: 'foreign-policy',
    weight: 0.8,
    searchTerms: ['rubio', 'secretary of state', 'state department'],
    persona: `You are Secretary of State Marco Rubio. You are a China hawk and human rights hardliner. You view the US-China competition through a civilizational lens. You push for tech decoupling, export controls on semiconductors, and defending Taiwan. You are skeptical of diplomatic engagement without preconditions. Your geopolitical framework puts ideological competition ahead of economic interdependence. Sanctions are your preferred tool.`,
  },
  {
    id: 'lutnick',
    name: 'Lutnick',
    role: 'commerce-secretary',
    weight: 0.8,
    searchTerms: ['lutnick', 'commerce', 'commerce secretary'],
    persona: `You are Commerce Secretary Howard Lutnick. You are focused on trade enforcement, domestic manufacturing, and tariff implementation. You come from Wall Street and understand how tariffs flow through supply chains. You are the operational arm of trade policy — you decide which products get tariffed, which get exemptions, and how enforcement works. You think in terms of Section 301, entity lists, and rules of origin.`,
  },
  {
    id: 'witkoff',
    name: 'Witkoff',
    role: 'middle-east-envoy',
    weight: 0.7,
    searchTerms: ['witkoff', 'envoy', 'middle east', 'ceasefire'],
    persona: `You are Middle East Envoy Steve Witkoff. You are a de-escalation specialist and ceasefire broker. You work diplomatic backchannels between Israel, Saudi Arabia, Iran, and Gulf states. You think about oil supply risk, Strait of Hormuz, and Abraham Accords expansion. When tensions rise in the Middle East, you assess whether it's posturing or genuine escalation. You are the market's read on geopolitical risk premium in energy.`,
  },
  {
    id: 'greer',
    name: 'Greer',
    role: 'trade-rep',
    weight: 0.8,
    searchTerms: ['greer', 'ustr', 'trade representative', 'trade rep'],
    persona: `You are US Trade Representative Jamieson Greer. You execute tariff implementation and negotiate trade deals. You are the technocrat who turns presidential trade announcements into legal reality. You work on reciprocal tariff schedules, trade deal enforcement, and WTO disputes. You think about effective tariff rates, trade diversion, and retaliatory escalation chains. When Trump announces tariffs, you determine the timeline, scope, and exemption process.`,
  },
  {
    id: 'navarro',
    name: 'Navarro',
    role: 'trade-advisor',
    weight: 0.7,
    searchTerms: ['navarro', 'trade advisor', 'peter navarro'],
    persona: `You are Senior Trade Advisor Peter Navarro. You are the most protectionist voice in the administration. You believe in manufacturing onshoring at any cost, view China as an existential economic threat, and see tariffs as a permanent tool, not a negotiating lever. You push for maximum tariff escalation, minimal exemptions, and reshoring incentives. When others counsel restraint, you counsel aggression. Markets fear your influence because you never blinks on trade war escalation.`,
  },
];

// ── Headline Augmentation (14-day decay) ────────────────────────────────────

async function fetchRecentHeadlinesForOfficial(agent: GovOfficialAgent): Promise<string[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Search for headlines mentioning this official's search terms
  const { data, error } = await sb
    .from('scored_riskflow_items')
    .select('title, summary, created_at')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !data?.length) return [];

  // Filter headlines that mention any of the official's search terms
  const lowerTerms = agent.searchTerms.map(t => t.toLowerCase());
  const matching = data.filter(row => {
    const text = `${row.title} ${row.summary ?? ''}`.toLowerCase();
    return lowerTerms.some(term => text.includes(term));
  });

  return matching.slice(0, 10).map(row =>
    `[${row.created_at.slice(0, 10)}] ${row.title}${row.summary ? ` — ${row.summary.slice(0, 120)}` : ''}`
  );
}

function buildAgentSystemPrompt(persona: string, headlines: string[]): string {
  let prompt = `${persona}

You are a government official participating in a MiroShark policy simulation. Based on your role and worldview, analyze the provided market context and assess how your policy domain affects market volatility and risk.`;

  if (headlines.length > 0) {
    prompt += `\n\n--- RECENT HEADLINES RELEVANT TO YOUR PORTFOLIO ---\n${headlines.join('\n')}\n--- END HEADLINES ---\n\nIncorporate these recent developments into your assessment. They reflect the latest actions and statements from your domain.`;
  }

  prompt += `

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

  return prompt;
}

/** Get the list of gov official agents (for frontend panel metadata) */
export function getGovOfficials() {
  return GOV_OFFICIALS.map(a => ({ id: a.id, name: a.name, role: a.role, weight: a.weight }));
}

export function isMiroSharkEnabled(): boolean {
  return isSkillEnabled('miroshark');
}

export async function runDebate(seed: MiroSharkSeed): Promise<MiroSharkReport> {
  const context = formatSeedContext(seed);
  const startTime = Date.now();

  // Fetch 14-day headlines for each official in parallel
  const headlineResults = await Promise.allSettled(
    GOV_OFFICIALS.map(agent => fetchRecentHeadlinesForOfficial(agent)),
  );
  const headlinesByAgent = GOV_OFFICIALS.map((_, i) =>
    headlineResults[i].status === 'fulfilled' ? headlineResults[i].value : [],
  );

  // Run all gov official agents in parallel
  const results = await Promise.allSettled(
    GOV_OFFICIALS.map((agent, i) => runGovAgent(agent, context, headlinesByAgent[i])),
  );

  const responses: MiroSharkAgentResponse[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      responses.push(result.value);
    } else {
      console.error('[MiroShark] Agent failed:', result.reason);
    }
  }

  if (responses.length === 0) {
    throw new Error('All MiroShark gov official agents failed');
  }

  console.log(`[MiroShark] Debate completed: ${responses.length}/${GOV_OFFICIALS.length} officials responded in ${Date.now() - startTime}ms`);
  return aggregateResponses(responses);
}

async function runGovAgent(
  agent: GovOfficialAgent,
  context: string,
  headlines: string[],
): Promise<MiroSharkAgentResponse> {
  const selection = selectModel({ taskType: 'reasoning' });
  const model = createModelClient(selection.model as AiModelKey);

  const systemPrompt = buildAgentSystemPrompt(agent.persona, headlines);

  const { text } = await generateText({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: context },
    ],
    temperature: 0.4,
    maxOutputTokens: 1024,
  });

  const parsed = parseJsonSafe<Omit<MiroSharkAgentResponse, 'agentId'>>(text);

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

function aggregateResponses(responses: MiroSharkAgentResponse[]): MiroSharkReport {
  const agentWeights = new Map(GOV_OFFICIALS.map(a => [a.id, a.weight]));
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
  responses: MiroSharkAgentResponse[],
  weights: Map<string, number>,
): MiroSharkCategoryScore[] {
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

function mergeScenarios(responses: MiroSharkAgentResponse[]): MiroSharkScenario[] {
  const all: MiroSharkScenario[] = [];
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
  const grouped = new Map<string, MiroSharkScenario[]>();
  for (const s of all) {
    const key = s.label.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);
    const group = grouped.get(key) ?? [];
    group.push(s);
    grouped.set(key, group);
  }

  const merged: MiroSharkScenario[] = [];
  for (const [, group] of grouped) {
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    merged.push({
      label: group[0].label,
      probability: Number(avg(group.map(g => g.probability)).toFixed(2)),
      projectedIVScore: Number(avg(group.map(g => g.projectedIVScore)).toFixed(1)),
      description: group[0].description,
      agentConsensus: Number((group.length / GOV_OFFICIALS.length).toFixed(2)),
    });
  }

  // Normalize probabilities and sort
  const total = merged.reduce((s, m) => s + m.probability, 0);
  for (const m of merged) m.probability = Number((m.probability / (total || 1)).toFixed(2));
  merged.sort((a, b) => b.probability - a.probability);

  return merged.slice(0, 6);
}

function deduplicateEvents(responses: MiroSharkAgentResponse[]): MiroSharkGeneratedEvent[] {
  const seen = new Set<string>();
  const events: MiroSharkGeneratedEvent[] = [];

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
  categoryScores: MiroSharkCategoryScore[],
  compositeScore: number,
  days: number,
): MiroSharkTimePoint[] {
  const points: MiroSharkTimePoint[] = [];
  const now = new Date();
  const meanTarget = 3.5;

  for (let d = 0; d <= days; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const decay = d / days;

    const categories = {} as Record<MiroSharkRiskCategory, number>;
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

function formatSeedContext(seed: MiroSharkSeed): string {
  const sections: string[] = ['=== MIROSHARK SIMULATION CONTEXT ==='];

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

  sections.push('\n--- TASK ---');
  sections.push('Analyze the above context. For each of the 6 risk categories (geopolitical, political, monetary-policy, earnings-corporate, market-structure, black-swan), provide an IV score (0-10), confidence (0-1), and delta from current baseline.');
  sections.push('Also provide 2-4 scenarios with probabilities, and 1-3 upcoming events you predict within the next 30 days.');

  return sections.join('\n');
}

function buildFallbackResponse(agentId: string): MiroSharkAgentResponse {
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

function normalizeCategories(scores: MiroSharkCategoryScore[] | undefined): MiroSharkCategoryScore[] {
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
