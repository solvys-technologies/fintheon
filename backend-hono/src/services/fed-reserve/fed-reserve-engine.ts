// Federal Reserve Deliberation Engine — MiroShark-inspired multi-round debate
// Unlike MiroFish's single-shot parallel agents, this runs iterative rounds
// where agents respond to each other, shift positions, and form coalitions.

import { generateText } from 'ai';
import { selectModel, createModelClient, type AiModelKey } from '../ai/model-selector.js';
import { FED_AGENTS } from './fed-reserve-agents.js';
import type {
  FedAgentProfile,
  FedAgentVote,
  FedSessionContext,
  FedDeliberationRound,
  FedExchange,
  FedCoalition,
  FedStance,
  FedVoteDecision,
  FedRateDecision,
  FedForwardGuidance,
  FedSessionReport,
} from './fed-reserve-types.js';

const DELIBERATION_ROUNDS = 3;

function buildAgentSystemPrompt(agent: FedAgentProfile): string {
  return `${agent.persona}

You are participating in an FOMC meeting simulation. You are ${agent.name}, the ${agent.archetype}.
Your default stance is ${agent.stance}. Your focus areas: ${agent.focusAreas.join(', ')}.

You will receive the current economic context and (in later rounds) other committee members' statements.
You may shift your position if persuaded by data or arguments, but stay in character.

Respond with valid JSON:
{
  "statement": "<your 2-4 sentence position statement for this round>",
  "stance": "<hawkish|dovish|neutral>",
  "conviction": <0-1, how strongly you hold this view>,
  "ratePreference": "<hike-50|hike-25|hold|cut-25|cut-50>",
  "dotPlotProjection": <where you see the fed funds rate in 12 months, e.g. 5.25>,
  "keyDataPoint": "<the single most important data point driving your view>",
  "responseToOthers": "<if others have spoken, who do you agree/disagree with and why — 1-2 sentences, or null if first round>"
}

Return ONLY the JSON object, no markdown fences.`;
}

function formatContextForAgents(ctx: FedSessionContext): string {
  const sections: string[] = ['=== FOMC MEETING CONTEXT ==='];

  sections.push(`\nCurrent Fed Funds Rate: ${ctx.currentFedFundsRate.toFixed(2)}%`);
  if (ctx.latestCPI != null) sections.push(`Latest CPI (YoY): ${ctx.latestCPI.toFixed(1)}%`);
  if (ctx.latestPCE != null) sections.push(`Latest Core PCE (YoY): ${ctx.latestPCE.toFixed(1)}%`);
  if (ctx.unemploymentRate != null) sections.push(`Unemployment Rate: ${ctx.unemploymentRate.toFixed(1)}%`);
  if (ctx.gdpGrowth != null) sections.push(`GDP Growth (QoQ annualized): ${ctx.gdpGrowth.toFixed(1)}%`);
  if (ctx.yieldCurve2s10s != null) {
    sections.push(`10Y-2Y Yield Curve: ${ctx.yieldCurve2s10s.toFixed(2)}% (${ctx.yieldCurve2s10s < 0 ? 'INVERTED — recession signal' : 'normal'})`);
  }
  if (ctx.vixLevel != null) sections.push(`VIX: ${ctx.vixLevel.toFixed(1)}`);

  if (ctx.riskflowHeadlines.length > 0) {
    sections.push('\n--- RECENT MACRO HEADLINES ---');
    for (const h of ctx.riskflowHeadlines.slice(0, 8)) {
      sections.push(`• [${h.sentiment}] ${h.title} (impact: ${h.macroLevel}/5)`);
    }
  }

  return sections.join('\n');
}

function formatPriorRound(round: FedDeliberationRound): string {
  const lines = [`\n--- ROUND ${round.round} COMMITTEE STATEMENTS ---`];
  for (const ex of round.exchanges) {
    lines.push(`[${ex.speakerName} — ${ex.stance}] ${ex.content}`);
  }
  return lines.join('\n');
}

interface AgentRoundResponse {
  statement: string;
  stance: FedStance;
  conviction: number;
  ratePreference: FedVoteDecision;
  dotPlotProjection: number;
  keyDataPoint: string;
  responseToOthers: string | null;
}

async function runAgentRound(
  agent: FedAgentProfile,
  contextText: string,
  priorRoundsText: string,
): Promise<AgentRoundResponse> {
  const selection = selectModel({ taskType: 'reasoning' });
  const model = createModelClient(selection.model as AiModelKey);

  const userContent = contextText + priorRoundsText +
    '\n\n--- YOUR TURN ---\nProvide your assessment and rate preference for this round.';

  const { text } = await generateText({
    model,
    messages: [
      { role: 'system', content: buildAgentSystemPrompt(agent) },
      { role: 'user', content: userContent },
    ],
    temperature: 0.5,
    maxOutputTokens: 512,
  });

  const parsed = parseJsonSafe<AgentRoundResponse>(text);
  if (!parsed) {
    return {
      statement: `${agent.name} maintains their ${agent.stance} stance based on current data.`,
      stance: agent.stance,
      conviction: 0.5,
      ratePreference: agent.stance === 'hawkish' ? 'hike-25' : agent.stance === 'dovish' ? 'cut-25' : 'hold',
      dotPlotProjection: agent.stance === 'hawkish' ? 5.5 : agent.stance === 'dovish' ? 4.5 : 5.0,
      keyDataPoint: 'Insufficient data for detailed analysis.',
      responseToOthers: null,
    };
  }

  return {
    statement: parsed.statement ?? `${agent.name} holds position.`,
    stance: validateStance(parsed.stance) ?? agent.stance,
    conviction: clamp(parsed.conviction ?? 0.5, 0, 1),
    ratePreference: validateDecision(parsed.ratePreference) ?? 'hold',
    dotPlotProjection: clamp(parsed.dotPlotProjection ?? 5.0, 0, 10),
    keyDataPoint: parsed.keyDataPoint ?? '',
    responseToOthers: parsed.responseToOthers ?? null,
  };
}

/**
 * Run the full FOMC deliberation — multi-round debate with stance shifts and coalition forming.
 */
export async function runDeliberation(
  context: FedSessionContext,
): Promise<Omit<FedSessionReport, 'sessionId' | 'status' | 'context' | 'generatedAt'>> {
  const contextText = formatContextForAgents(context);
  const rounds: FedDeliberationRound[] = [];
  const agentStances = new Map<string, FedStance>(
    FED_AGENTS.map(a => [a.id, a.stance]),
  );
  const agentResponses = new Map<string, AgentRoundResponse>();

  console.log(`[FedReserve] Starting deliberation with ${FED_AGENTS.length} agents, ${DELIBERATION_ROUNDS} rounds`);
  const startTime = Date.now();

  for (let roundNum = 1; roundNum <= DELIBERATION_ROUNDS; roundNum++) {
    const priorText = rounds.map(r => formatPriorRound(r)).join('\n');
    const exchanges: FedExchange[] = [];
    const stanceShifts: FedDeliberationRound['stanceShifts'] = [];

    // Run agents in parallel for each round
    const results = await Promise.allSettled(
      FED_AGENTS.map(agent => runAgentRound(agent, contextText, priorText)),
    );

    for (let i = 0; i < FED_AGENTS.length; i++) {
      const agent = FED_AGENTS[i];
      const result = results[i];

      if (result.status === 'rejected') {
        console.error(`[FedReserve] Agent ${agent.id} failed round ${roundNum}:`, result.reason);
        continue;
      }

      const response = result.value;
      agentResponses.set(agent.id, response);

      exchanges.push({
        speakerId: agent.id,
        speakerName: agent.name,
        content: response.statement,
        stance: response.stance,
        conviction: response.conviction,
      });

      // Track stance shifts
      const prevStance = agentStances.get(agent.id)!;
      if (response.stance !== prevStance) {
        stanceShifts.push({
          agentId: agent.id,
          from: prevStance,
          to: response.stance,
          reason: response.responseToOthers ?? 'Data-driven shift.',
        });
        agentStances.set(agent.id, response.stance);
      }
    }

    // Detect coalitions
    const coalitions = detectCoalitions(exchanges);

    const phase: FedDeliberationRound['phase'] =
      roundNum === 1 ? 'opening-statements' :
      roundNum === DELIBERATION_ROUNDS ? 'coalition-forming' :
      'deliberation';

    rounds.push({ round: roundNum, phase, exchanges, stanceShifts, coalitions });
  }

  // Final vote
  const votes = buildFinalVotes(agentResponses);
  const rateDecision = tallyVotes(votes);
  const forwardGuidance = deriveForwardGuidance(votes, rateDecision, context);

  // Compute the monetary policy signal for MiroFish
  const monetaryPolicySignal = computeMonetaryPolicySignal(rateDecision, forwardGuidance, context);
  const signalConfidence = rateDecision.consensusStrength;
  const regimeShiftProbability = computeRegimeShiftProbability(rateDecision, context);

  const briefingSummary = generateBriefingSummary(rateDecision, forwardGuidance, votes, context);

  console.log(`[FedReserve] Deliberation complete in ${Date.now() - startTime}ms. Decision: ${rateDecision.decision}, consensus: ${(rateDecision.consensusStrength * 100).toFixed(0)}%`);

  return {
    agents: FED_AGENTS,
    deliberationRounds: rounds,
    rateDecision,
    forwardGuidance,
    monetaryPolicySignal,
    signalConfidence,
    regimeShiftProbability,
    briefingSummary,
  };
}

function buildFinalVotes(responses: Map<string, AgentRoundResponse>): FedAgentVote[] {
  const votes: FedAgentVote[] = [];

  for (const agent of FED_AGENTS) {
    const resp = responses.get(agent.id);
    if (!resp) continue;

    // Determine majority stance to detect dissent
    const allStances = Array.from(responses.values()).map(r => r.ratePreference);
    const modePref = mode(allStances);
    const isDissent = resp.ratePreference !== modePref;

    votes.push({
      agentId: agent.id,
      agentName: agent.name,
      decision: resp.ratePreference,
      stance: resp.stance,
      confidence: resp.conviction,
      reasoning: resp.statement,
      dissent: isDissent,
      dissentStatement: isDissent ? `${agent.name} dissents, preferring ${formatDecision(resp.ratePreference)}: ${resp.keyDataPoint}` : undefined,
      influencedBy: resp.responseToOthers
        ? FED_AGENTS.filter(a => resp.responseToOthers!.toLowerCase().includes(a.name.toLowerCase())).map(a => a.id)
        : [],
      dotPlotProjection: resp.dotPlotProjection,
    });
  }

  return votes;
}

function tallyVotes(votes: FedAgentVote[]): FedRateDecision {
  const voteCount: Record<FedVoteDecision, number> = {
    'hike-50': 0, 'hike-25': 0, 'hold': 0, 'cut-25': 0, 'cut-50': 0,
  };

  for (const v of votes) {
    voteCount[v.decision] = (voteCount[v.decision] ?? 0) + 1;
  }

  // Weighted vote using influence
  const weightedVotes = new Map<FedVoteDecision, number>();
  for (const v of votes) {
    const agent = FED_AGENTS.find(a => a.id === v.agentId);
    const weight = agent?.influenceWeight ?? 0.5;
    weightedVotes.set(v.decision, (weightedVotes.get(v.decision) ?? 0) + weight);
  }

  let decision: FedVoteDecision = 'hold';
  let maxWeight = 0;
  for (const [d, w] of weightedVotes) {
    if (w > maxWeight) { maxWeight = w; decision = d; }
  }

  const winningCount = voteCount[decision];
  const totalVotes = votes.length;
  const dissentCount = totalVotes - winningCount;
  const consensusStrength = winningCount / Math.max(totalVotes, 1);

  const dots = votes.map(v => v.dotPlotProjection).sort((a, b) => a - b);
  const medianDotPlot = dots[Math.floor(dots.length / 2)] ?? 5.0;

  return {
    decision,
    voteCount,
    totalVotes,
    dissentCount,
    consensusStrength: Number(consensusStrength.toFixed(2)),
    medianDotPlot: Number(medianDotPlot.toFixed(2)),
    dotPlotRange: {
      low: dots[0] ?? 4.0,
      high: dots[dots.length - 1] ?? 6.0,
    },
  };
}

function deriveForwardGuidance(
  votes: FedAgentVote[],
  decision: FedRateDecision,
  context: FedSessionContext,
): FedForwardGuidance {
  const hawkCount = votes.filter(v => v.stance === 'hawkish').length;
  const doveCount = votes.filter(v => v.stance === 'dovish').length;
  const total = votes.length || 1;

  const hawkishProbability = Number((hawkCount / total).toFixed(2));
  const dovishProbability = Number((doveCount / total).toFixed(2));

  let signal: FedForwardGuidance['signal'];
  if (decision.decision.includes('hike')) signal = 'tightening';
  else if (decision.decision.includes('cut')) signal = 'easing';
  else if (hawkishProbability > 0.5) signal = 'tightening';
  else if (dovishProbability > 0.5) signal = 'easing';
  else signal = 'data-dependent';

  // Project next meeting based on momentum
  let nextMeetingExpectation: FedVoteDecision;
  if (signal === 'tightening' && decision.consensusStrength > 0.6) {
    nextMeetingExpectation = 'hike-25';
  } else if (signal === 'easing' && decision.consensusStrength > 0.6) {
    nextMeetingExpectation = 'cut-25';
  } else {
    nextMeetingExpectation = 'hold';
  }

  const keyRisks = votes
    .map(v => v.reasoning)
    .filter(r => r.toLowerCase().includes('risk'))
    .slice(0, 3);

  const dissenterNarratives = votes
    .filter(v => v.dissent && v.dissentStatement)
    .map(v => v.dissentStatement!);

  return {
    signal,
    hawkishProbability,
    dovishProbability,
    nextMeetingExpectation,
    keyRisks,
    dissenterNarratives,
  };
}

function computeMonetaryPolicySignal(
  decision: FedRateDecision,
  guidance: FedForwardGuidance,
  context: FedSessionContext,
): number {
  // Base signal from rate decision (0 = very dovish/easing, 10 = very hawkish/tightening)
  const decisionScore: Record<FedVoteDecision, number> = {
    'cut-50': 2, 'cut-25': 3.5, 'hold': 5, 'hike-25': 6.5, 'hike-50': 8,
  };
  let signal = decisionScore[decision.decision];

  // Adjust for dissent direction
  if (decision.dissentCount > 2) {
    signal += guidance.hawkishProbability > guidance.dovishProbability ? 0.5 : -0.5;
  }

  // Adjust for context — high inflation pushes signal up
  if (context.latestCPI != null && context.latestCPI > 4) signal += 0.5;
  if (context.latestCPI != null && context.latestCPI < 2) signal -= 0.5;

  // Inverted yield curve adds uncertainty
  if (context.yieldCurve2s10s != null && context.yieldCurve2s10s < 0) signal += 0.5;

  return clamp(Number(signal.toFixed(1)), 0, 10);
}

function computeRegimeShiftProbability(
  decision: FedRateDecision,
  context: FedSessionContext,
): number {
  let prob = 0.05; // baseline

  // High dissent → higher regime shift probability
  if (decision.dissentCount >= 3) prob += 0.1;
  if (decision.dissentCount >= 4) prob += 0.15;

  // Low consensus → uncertainty
  if (decision.consensusStrength < 0.5) prob += 0.1;

  // Extreme actions signal regime change
  if (decision.decision === 'hike-50' || decision.decision === 'cut-50') prob += 0.15;

  // Wide dot plot range → disagreement about path
  const dotRange = decision.dotPlotRange.high - decision.dotPlotRange.low;
  if (dotRange > 2) prob += 0.1;

  // Inverted yield curve
  if (context.yieldCurve2s10s != null && context.yieldCurve2s10s < -0.5) prob += 0.1;

  return clamp(Number(prob.toFixed(3)), 0, 1);
}

function generateBriefingSummary(
  decision: FedRateDecision,
  guidance: FedForwardGuidance,
  votes: FedAgentVote[],
  context: FedSessionContext,
): string {
  const decisionText = formatDecision(decision.decision);
  const parts: string[] = [];

  parts.push(`FOMC simulation: ${decisionText} (${decision.voteCount[decision.decision]}-${decision.dissentCount} vote).`);
  parts.push(`Consensus strength ${(decision.consensusStrength * 100).toFixed(0)}%.`);
  parts.push(`Median dot plot: ${decision.medianDotPlot}% (range ${decision.dotPlotRange.low}%-${decision.dotPlotRange.high}%).`);
  parts.push(`Forward guidance signal: ${guidance.signal}.`);

  if (decision.dissentCount > 0) {
    const dissenters = votes.filter(v => v.dissent).map(v => v.agentName);
    parts.push(`Dissenters: ${dissenters.join(', ')}.`);
  }

  if (context.latestCPI != null) parts.push(`CPI context: ${context.latestCPI.toFixed(1)}%.`);

  return parts.join(' ');
}

function detectCoalitions(exchanges: FedExchange[]): FedCoalition[] {
  const stanceGroups = new Map<FedStance, string[]>();
  for (const ex of exchanges) {
    const group = stanceGroups.get(ex.stance) ?? [];
    group.push(ex.speakerId);
    stanceGroups.set(ex.stance, group);
  }

  const coalitions: FedCoalition[] = [];
  const total = exchanges.length || 1;

  if (stanceGroups.has('hawkish') && stanceGroups.get('hawkish')!.length >= 2) {
    const members = stanceGroups.get('hawkish')!;
    coalitions.push({
      name: 'Hawk Coalition',
      stance: 'hawkish',
      memberIds: members,
      strength: members.length / total,
    });
  }

  if (stanceGroups.has('dovish') && stanceGroups.get('dovish')!.length >= 2) {
    const members = stanceGroups.get('dovish')!;
    coalitions.push({
      name: 'Dove Coalition',
      stance: 'dovish',
      memberIds: members,
      strength: members.length / total,
    });
  }

  if (stanceGroups.has('neutral') && stanceGroups.get('neutral')!.length >= 2) {
    const members = stanceGroups.get('neutral')!;
    coalitions.push({
      name: 'Centrist Bloc',
      stance: 'neutral',
      memberIds: members,
      strength: members.length / total,
    });
  }

  return coalitions;
}

function formatDecision(d: FedVoteDecision): string {
  const map: Record<FedVoteDecision, string> = {
    'hike-50': '+50bp rate hike',
    'hike-25': '+25bp rate hike',
    'hold': 'rates unchanged',
    'cut-25': '-25bp rate cut',
    'cut-50': '-50bp rate cut',
  };
  return map[d] ?? d;
}

function validateStance(s: unknown): FedStance | null {
  if (s === 'hawkish' || s === 'dovish' || s === 'neutral') return s;
  return null;
}

function validateDecision(d: unknown): FedVoteDecision | null {
  const valid: FedVoteDecision[] = ['hike-50', 'hike-25', 'hold', 'cut-25', 'cut-50'];
  if (typeof d === 'string' && valid.includes(d as FedVoteDecision)) return d as FedVoteDecision;
  return null;
}

function mode<T>(arr: T[]): T {
  const freq = new Map<T, number>();
  let maxFreq = 0;
  let result = arr[0];
  for (const item of arr) {
    const count = (freq.get(item) ?? 0) + 1;
    freq.set(item, count);
    if (count > maxFreq) { maxFreq = count; result = item; }
  }
  return result;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function parseJsonSafe<T>(text: string): T | null {
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
