// [claude-code 2026-03-28] S8-T5: 3-phase deliberation pipeline — MiroShark → Hermes → Harper-Opus

import { generateText } from 'ai';
import { selectModel, createModelClient, type AiModelKey } from '../ai/model-selector.js';
import { createHermesClient, isHermesAvailable, type HermesAgentRole } from '../hermes-service.js';
import { getAgentSystemPrompt } from '../ai/agent-instructions/index.js';
import type {
  MiroSharkReport,
  MiroSharkCategoryScore,
  GovOfficialAssessment,
  HermesDeliberation,
  HarperOpusScoring,
  DeliberationState,
  DeliberationPhase,
} from './miroshark-types.js';

// ── In-memory deliberation tracking ─────────────────────────────────────────

const activeDeliberations = new Map<string, DeliberationState>();

export function getDeliberationState(simId: string): DeliberationState | null {
  return activeDeliberations.get(simId) ?? null;
}

function updatePhase(simId: string, phase: DeliberationPhase, updates?: Partial<DeliberationState>): void {
  const current = activeDeliberations.get(simId);
  if (current) {
    Object.assign(current, { phase, phaseStartedAt: new Date().toISOString(), ...updates });
  }
}

// ── Phase 1: Extract structured assessments from MiroShark report ───────────

export function extractGovAssessments(report: MiroSharkReport): GovOfficialAssessment[] {
  return report.agentVotes.map(vote => {
    const reasoning = ''; // Reasoning stored in agentVotes doesn't include full text
    return {
      agentId: vote.agentId,
      name: formatAgentName(vote.agentId),
      role: vote.agentId,
      assessment: `Position: ${vote.position}, Confidence: ${(vote.confidence * 100).toFixed(0)}%`,
      confidence: vote.confidence,
      keyConcern: vote.position === 'high-vol' ? 'Elevated volatility risk' : vote.position === 'low-vol' ? 'Markets underpricing calm' : 'Mixed signals',
      recommendedAction: vote.position === 'high-vol' ? 'Reduce exposure, widen stops' : vote.position === 'low-vol' ? 'Trend continuation, standard sizing' : 'Wait for clarity',
      projectedIVScore: report.nextSessionProjection,
      regimeShiftProbability: report.regimeShiftProbability,
      categoryScores: report.categoryScores,
    };
  });
}

function formatAgentName(agentId: string): string {
  const names: Record<string, string> = {
    'fed-chair': 'Fed Chair',
    'trump': 'Trump',
    'bessent': 'Bessent',
    'rubio': 'Rubio',
    'lutnick': 'Lutnick',
    'witkoff': 'Witkoff',
    'greer': 'Greer',
    'navarro': 'Navarro',
  };
  return names[agentId] ?? agentId;
}

// ── Phase 2: Hermes Deliberation ────────────────────────────────────────────

const HERMES_DELIBERATION_AGENTS: HermesAgentRole[] = [
  'pma-merged',        // Oracle
  'futures-desk',      // Feucht
  'fundamentals-desk', // Consul
  'herald',            // Herald
];

async function runHermesDeliberation(
  assessments: GovOfficialAssessment[],
  report: MiroSharkReport,
  userInjection?: string,
): Promise<HermesDeliberation[]> {
  // Build a summary of gov official outputs for Hermes to evaluate
  const govSummary = assessments.map(a =>
    `${a.name} (${a.role}): ${a.assessment}. Key concern: ${a.keyConcern}. Action: ${a.recommendedAction}.`
  ).join('\n');

  const majorityPosition = getMajorityPosition(report);

  const deliberationPrompt = `You are evaluating the output of a MiroShark government official simulation.

## Gov Official Assessments
${govSummary}

## Composite Results
- Composite IV: ${report.nextSessionProjection.toFixed(1)}
- Regime Shift Probability: ${(report.regimeShiftProbability * 100).toFixed(0)}%
- Confidence: ${(report.confidence * 100).toFixed(0)}%
- Majority Position: ${majorityPosition}

${userInjection ? `## User Injection\n${userInjection}\n` : ''}
## Your Task
Evaluate whether you AGREE, DISAGREE, or see NUANCE in the gov officials' combined assessment.
Consider: Are they missing something? Is the consensus too strong or too weak? What would change your mind?

Respond with valid JSON:
{
  "verdict": "agree" | "disagree" | "nuance",
  "reasoning": "<2-3 sentences explaining your position>",
  "confidence": <0-1>
}

Return ONLY the JSON object, no markdown fences.`;

  const results = await Promise.allSettled(
    HERMES_DELIBERATION_AGENTS.map(async (agentRole) => {
      const selection = selectModel({ taskType: 'reasoning' });
      const model = createModelClient(selection.model as AiModelKey);

      const { text } = await generateText({
        model,
        messages: [
          { role: 'system', content: `You are ${getHermesDisplayName(agentRole)}, a P.I.C. Hermes agent. Evaluate the MiroShark simulation results from your perspective.` },
          { role: 'user', content: deliberationPrompt },
        ],
        temperature: 0.3,
        maxOutputTokens: 512,
      });

      const parsed = parseJsonSafe<{ verdict: string; reasoning: string; confidence: number }>(text);
      if (!parsed) {
        return {
          agentId: agentRole,
          name: getHermesDisplayName(agentRole),
          verdict: 'nuance' as const,
          reasoning: 'Unable to parse deliberation response.',
          confidence: 0.3,
        };
      }

      return {
        agentId: agentRole,
        name: getHermesDisplayName(agentRole),
        verdict: (parsed.verdict === 'agree' || parsed.verdict === 'disagree' ? parsed.verdict : 'nuance') as 'agree' | 'disagree' | 'nuance',
        reasoning: parsed.reasoning ?? '',
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
      };
    }),
  );

  const fulfilled: HermesDeliberation[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') fulfilled.push(r.value);
  }
  return fulfilled;
}

function getHermesDisplayName(role: HermesAgentRole): string {
  const names: Record<string, string> = {
    'pma-merged': 'Oracle',
    'futures-desk': 'Feucht',
    'fundamentals-desk': 'Consul',
    'herald': 'Herald',
  };
  return names[role] ?? role;
}

function getMajorityPosition(report: MiroSharkReport): string {
  const votes = report.agentVotes;
  const highVol = votes.filter(v => v.position === 'high-vol').length;
  const lowVol = votes.filter(v => v.position === 'low-vol').length;
  if (highVol > votes.length / 2) return 'high-vol';
  if (lowVol > votes.length / 2) return 'low-vol';
  return 'mixed';
}

// ── Phase 3: Harper-Opus Scoring ────────────────────────────────────────────

async function runHarperScoring(
  report: MiroSharkReport,
  assessments: GovOfficialAssessment[],
  hermesResults: HermesDeliberation[],
  userInjection?: string,
): Promise<HarperOpusScoring> {
  const selection = selectModel({ taskType: 'reasoning' });
  const model = createModelClient(selection.model as AiModelKey);

  // Detect consensus vs divergence
  const hermesAgree = hermesResults.filter(h => h.verdict === 'agree').length;
  const hermesDisagree = hermesResults.filter(h => h.verdict === 'disagree').length;
  const isContested = hermesDisagree >= 2 || (hermesAgree < hermesResults.length / 2);

  const scoringPrompt = `You are Harper-Opus, the Chief Agentic Officer scoring a MiroShark deliberation.

## Phase 1: Gov Official Simulation
Composite IV: ${report.nextSessionProjection.toFixed(1)}
Regime Shift: ${(report.regimeShiftProbability * 100).toFixed(0)}%
Officials: ${assessments.map(a => `${a.name}: ${a.keyConcern}`).join('; ')}

## Phase 2: Hermes Deliberation
${hermesResults.map(h => `${h.name}: ${h.verdict.toUpperCase()} — ${h.reasoning} (confidence: ${(h.confidence * 100).toFixed(0)}%)`).join('\n')}
Consensus: ${isContested ? 'CONTESTED — Hermes agents disagree with majority' : 'ALIGNED — Hermes agents largely agree'}

${userInjection ? `## User Injection\n${userInjection}\n` : ''}
## Category Scores
${report.categoryScores.map(c => `${c.category}: ${c.ivScore.toFixed(1)} (conf ${(c.confidence * 100).toFixed(0)}%)`).join('\n')}

## Your Task
Score the combined output. Decide which theses to surface and which to downgrade.

Respond with valid JSON:
{
  "compositeIV": <adjusted 0-10>,
  "regimeShiftProbability": <adjusted 0-1>,
  "categoryScores": [{ "category": "<cat>", "ivScore": <0-10>, "confidence": <0-1>, "delta": <change> }],
  "surfacedTheses": ["<thesis worth trading on>"],
  "downgradedTheses": ["<thesis to ignore>"],
  "contestedTheses": ["<thesis where agents disagree>"],
  "actionabilityScore": <0-10, how tradeable>,
  "finalBriefing": "<3-5 sentence executive summary for the trading desk>"
}

Return ONLY JSON, no markdown.`;

  const { text } = await generateText({
    model,
    messages: [
      { role: 'system', content: 'You are Harper-Opus, the Chief Agentic Officer of Priced In Capital. You make the final call on which market theses to surface, which to downgrade, and how to score the combined intelligence from gov officials and Hermes agents. Be decisive. Think like a PM running a book.' },
      { role: 'user', content: scoringPrompt },
    ],
    temperature: 0.3,
    maxOutputTokens: 1024,
  });

  const parsed = parseJsonSafe<HarperOpusScoring>(text);
  if (!parsed) {
    // Fallback: pass through MiroShark scores
    return {
      compositeIV: report.nextSessionProjection,
      regimeShiftProbability: report.regimeShiftProbability,
      categoryScores: report.categoryScores,
      surfacedTheses: report.scenarios.slice(0, 2).map(s => s.label),
      downgradedTheses: [],
      contestedTheses: isContested ? ['Overall thesis is contested by Hermes agents'] : [],
      actionabilityScore: report.confidence * 10,
      finalBriefing: 'Harper-Opus scoring failed to parse. Falling back to raw MiroShark results.',
    };
  }

  return {
    compositeIV: Math.max(0, Math.min(10, parsed.compositeIV ?? report.nextSessionProjection)),
    regimeShiftProbability: Math.max(0, Math.min(1, parsed.regimeShiftProbability ?? report.regimeShiftProbability)),
    categoryScores: parsed.categoryScores?.length ? parsed.categoryScores : report.categoryScores,
    surfacedTheses: parsed.surfacedTheses ?? [],
    downgradedTheses: parsed.downgradedTheses ?? [],
    contestedTheses: parsed.contestedTheses ?? [],
    actionabilityScore: Math.max(0, Math.min(10, parsed.actionabilityScore ?? 5)),
    finalBriefing: parsed.finalBriefing ?? '',
  };
}

// ── Full Deliberation Pipeline ──────────────────────────────────────────────

export async function runDeliberationPipeline(
  simId: string,
  report: MiroSharkReport,
): Promise<DeliberationState> {
  const state: DeliberationState = {
    simulationId: simId,
    phase: 'miroshark-sim',
    phaseStartedAt: new Date().toISOString(),
  };
  activeDeliberations.set(simId, state);

  try {
    // Phase 1: Extract gov official assessments from MiroShark report
    const govAssessments = extractGovAssessments(report);
    updatePhase(simId, 'hermes-deliberation', { mirosharkResults: govAssessments });

    // Check for user interrupt before Phase 2
    const currentState = activeDeliberations.get(simId)!;
    if (currentState.phase === 'interrupted') return currentState;

    // Phase 2: Hermes deliberation
    const hermesResults = await runHermesDeliberation(
      govAssessments,
      report,
      currentState.userInjection,
    );
    updatePhase(simId, 'harper-scoring', { hermesResults });

    // Check for user interrupt before Phase 3
    const stateAfterHermes = activeDeliberations.get(simId)!;
    if (stateAfterHermes.phase === 'interrupted') return stateAfterHermes;

    // Phase 3: Harper-Opus scoring
    const harperScoring = await runHarperScoring(
      report,
      govAssessments,
      hermesResults,
      stateAfterHermes.userInjection,
    );
    updatePhase(simId, 'complete', { harperScoring });

    return activeDeliberations.get(simId)!;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Deliberation pipeline failed';
    console.error('[MiroShark Deliberation]', msg);
    updatePhase(simId, 'complete', { error: msg });
    return activeDeliberations.get(simId)!;
  }
}

/** Inject a user take into an active deliberation (pauses before next phase) */
export function injectUserTake(simId: string, take: string): boolean {
  const state = activeDeliberations.get(simId);
  if (!state || state.phase === 'complete' || state.phase === 'idle') return false;

  state.userInjection = take;
  return true;
}

// ── Utilities ───────────────────────────────────────────────────────────────

function parseJsonSafe<T>(text: string): T | null {
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
