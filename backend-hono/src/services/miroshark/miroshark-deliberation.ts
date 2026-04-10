// [claude-code 2026-04-03] Deliberation v2 — 4-phase pipeline with anti-groupthink + consensus scoring
// Phase 1: Market analysts (always) → Phase 1.5: Gov officials (conditional) → Phase 2: Hermes → Phase 3: Harper
// Fixes: full reasoning passthrough (no more lossy one-line summaries), convergence detection, devil's advocate

import { invokeAgent } from "../strands/index.js";
import type { HermesAgentRole } from "../hermes-service.js";
import type {
  MiroSharkReport,
  MiroSharkAgentResponse,
  GovOfficialAssessment,
  MarketAnalystAssessment,
  HermesDeliberation,
  HarperOpusScoring,
  DeliberationState,
  DeliberationPhase,
} from "./miroshark-types.js";
import { MARKET_ANALYSTS } from "./miroshark-client.js";

// ── In-memory deliberation tracking ─────────────────────────────────────────

const activeDeliberations = new Map<string, DeliberationState>();

export function getDeliberationState(simId: string): DeliberationState | null {
  return activeDeliberations.get(simId) ?? null;
}

function updatePhase(
  simId: string,
  phase: DeliberationPhase,
  updates?: Partial<DeliberationState>,
): void {
  const current = activeDeliberations.get(simId);
  if (current) {
    Object.assign(current, {
      phase,
      phaseStartedAt: new Date().toISOString(),
      ...updates,
    });
  }
}

// ── Phase 1: Extract FULL analyst assessments from report ───────────────────
// Critical fix: the old extractGovAssessments() threw away reasoning, category
// scores, scenarios, and generated events. Now we pass through everything.

export function extractAnalystAssessments(
  report: MiroSharkReport,
  agentResponses?: MiroSharkAgentResponse[],
): MarketAnalystAssessment[] {
  return report.agentVotes.map((vote) => {
    const analyst = MARKET_ANALYSTS.find((a) => a.id === vote.agentId);
    // Find the full response for this agent (if available from the report)
    const fullResponse = agentResponses?.find(
      (r) => r.agentId === vote.agentId,
    );

    return {
      agentId: vote.agentId,
      name: analyst?.name ?? vote.agentId,
      title: analyst?.title ?? vote.agentId,
      role: analyst?.role ?? "analyst",
      subjects: analyst?.subjects ?? [],
      // FULL reasoning — not a one-line summary
      assessment:
        fullResponse?.reasoning ??
        `Position: ${vote.position}, Confidence: ${(vote.confidence * 100).toFixed(0)}%`,
      confidence: vote.confidence,
      keyConcern: fullResponse
        ? extractKeyConcern(fullResponse)
        : vote.position === "high-vol"
          ? "Elevated volatility risk"
          : "Mixed signals",
      projectedIVScore:
        fullResponse?.projectedIVScore ?? report.nextSessionProjection,
      regimeShiftProbability:
        fullResponse?.regimeShiftProbability ?? report.regimeShiftProbability,
      // Per-agent category scores — NOT the composite
      categoryScores: fullResponse?.categoryScores ?? report.categoryScores,
      headlineCount: 0, // Will be populated when we have headline routing data
    };
  });
}

function extractKeyConcern(response: MiroSharkAgentResponse): string {
  // Find the highest-scoring category as the key concern
  const sorted = [...response.categoryScores].sort(
    (a, b) => b.ivScore - a.ivScore,
  );
  if (sorted.length > 0 && sorted[0].ivScore >= 6) {
    return `Elevated ${sorted[0].category} risk (${sorted[0].ivScore.toFixed(1)}/10)`;
  }
  return response.reasoning?.slice(0, 100) ?? "Mixed signals";
}

export function extractGovAssessments(
  report: MiroSharkReport,
): GovOfficialAssessment[] {
  const GOV_NAMES: Record<string, string> = {
    "fed-chair": "Fed Chair",
    trump: "Trump",
    bessent: "Bessent",
    rubio: "Rubio",
    lutnick: "Lutnick",
    witkoff: "Witkoff",
    greer: "Greer",
    navarro: "Navarro",
  };

  return report.agentVotes.map((vote) => ({
    agentId: vote.agentId,
    name: GOV_NAMES[vote.agentId] ?? vote.agentId,
    role: vote.agentId,
    assessment: `Position: ${vote.position}, Confidence: ${(vote.confidence * 100).toFixed(0)}%`,
    confidence: vote.confidence,
    keyConcern:
      vote.position === "high-vol"
        ? "Elevated volatility risk"
        : vote.position === "low-vol"
          ? "Markets underpricing calm"
          : "Mixed signals",
    recommendedAction:
      vote.position === "high-vol"
        ? "Reduce exposure, widen stops"
        : vote.position === "low-vol"
          ? "Trend continuation, standard sizing"
          : "Wait for clarity",
    projectedIVScore: report.nextSessionProjection,
    regimeShiftProbability: report.regimeShiftProbability,
    categoryScores: report.categoryScores,
  }));
}

// ── Anti-Groupthink: Convergence Detection ──────────────────────────────────

interface ConvergenceResult {
  convergence: number; // 0-1, where 1 = perfect agreement (bad)
  shouldTriggerContrarian: boolean;
  lowestConfidenceAgent: string | null;
  healthyDisagreementCount: number;
}

function detectConvergence(
  assessments: MarketAnalystAssessment[],
): ConvergenceResult {
  if (assessments.length < 2) {
    return {
      convergence: 0,
      shouldTriggerContrarian: false,
      lowestConfidenceAgent: null,
      healthyDisagreementCount: 0,
    };
  }

  const ivScores = assessments.map((a) => a.projectedIVScore);
  const mean = ivScores.reduce((s, v) => s + v, 0) / ivScores.length;
  const variance =
    ivScores.reduce((s, v) => s + (v - mean) ** 2, 0) / ivScores.length;
  const stddev = Math.sqrt(variance);

  // Convergence = 1 - (normalized stddev). High convergence = groupthink risk.
  const convergence =
    mean > 0 ? Math.max(0, Math.min(1, 1 - stddev / mean)) : 0;

  // Count analysts whose IV diverges by > 1.5 from mean (healthy disagreement)
  const healthyDisagreementCount = ivScores.filter(
    (v) => Math.abs(v - mean) > 1.5,
  ).length;

  // Find lowest confidence analyst for contrarian re-run
  let lowestConf = Infinity;
  let lowestAgent: string | null = null;
  for (const a of assessments) {
    if (a.confidence < lowestConf) {
      lowestConf = a.confidence;
      lowestAgent = a.agentId;
    }
  }

  return {
    convergence,
    shouldTriggerContrarian: convergence > 0.85,
    lowestConfidenceAgent: lowestAgent,
    healthyDisagreementCount,
  };
}

// ── Consensus Scoring ───────────────────────────────────────────────────────

function computeConsensusScore(
  analystAssessments: MarketAnalystAssessment[],
  hermesResults: HermesDeliberation[],
  convergence: ConvergenceResult,
  contrarianTriggered: boolean,
): number {
  let score = 0;

  // Base: weighted average of analyst confidences (0-50 pts)
  if (analystAssessments.length > 0) {
    const avgConf =
      analystAssessments.reduce((s, a) => s + a.confidence, 0) /
      analystAssessments.length;
    score += avgConf * 50;
  }

  // Agreement bonus/penalty from Hermes (±25 pts)
  if (hermesResults.length > 0) {
    const agreeCount = hermesResults.filter(
      (h) => h.verdict === "agree",
    ).length;
    const disagreeCount = hermesResults.filter(
      (h) => h.verdict === "disagree",
    ).length;
    const agreeRatio = agreeCount / hermesResults.length;
    const disagreeRatio = disagreeCount / hermesResults.length;

    score += agreeRatio * 25; // Agreement bonus
    score -= disagreeRatio * 20; // Disagreement penalty
  }

  // Convergence penalty: groupthink lowers score, not raises it
  if (convergence.convergence > 0.9) {
    score -= 10;
  }

  // Contrarian bonus: devil's advocate changed things = +5
  if (contrarianTriggered) {
    score += 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ── Phase 2: Hermes Deliberation (upgraded prompt) ──────────────────────────

const HERMES_DELIBERATION_AGENTS: HermesAgentRole[] = [
  "pma-merged", // Oracle
  "futures-desk", // Feucht
  "fundamentals-desk", // Consul
  "herald", // Herald
];

async function runHermesDeliberation(
  analystAssessments: MarketAnalystAssessment[],
  govAssessments: GovOfficialAssessment[] | null,
  report: MiroSharkReport,
  convergenceResult: ConvergenceResult,
  userInjection?: string,
): Promise<HermesDeliberation[]> {
  // Build FULL analyst summary — not one-line position summaries
  const analystSummary = analystAssessments
    .map((a) => {
      const topCategories = [...a.categoryScores]
        .sort((x, y) => y.ivScore - x.ivScore)
        .slice(0, 3)
        .map((c) => `${c.category}: ${c.ivScore.toFixed(1)}`)
        .join(", ");

      return `**${a.name} (${a.title})** [subjects: ${a.subjects.join(", ")}]
  IV: ${a.projectedIVScore.toFixed(1)} | Confidence: ${(a.confidence * 100).toFixed(0)}% | Regime: ${(a.regimeShiftProbability * 100).toFixed(0)}%
  Key Concern: ${a.keyConcern}
  Top Categories: ${topCategories}
  Reasoning: ${a.assessment}`;
    })
    .join("\n\n");

  const govSection = govAssessments
    ? `\n## Phase 1.5: Gov Official Assessments (geopolitical layer)\n${govAssessments.map((a) => `${a.name}: ${a.assessment}. Concern: ${a.keyConcern}. Action: ${a.recommendedAction}.`).join("\n")}`
    : "\n## Phase 1.5: Gov Officials — SKIPPED (no geopolitical content detected)";

  const majorityPosition = getMajorityPosition(report);

  const deliberationPrompt = `You are evaluating the combined output of a MiroShark market analysis.

## Phase 1: Market Analyst Assessments
${analystSummary}
${govSection}

## Composite Results
- Composite IV: ${report.nextSessionProjection.toFixed(1)}
- Regime Shift Probability: ${(report.regimeShiftProbability * 100).toFixed(0)}%
- Confidence: ${(report.confidence * 100).toFixed(0)}%
- Majority Position: ${majorityPosition}
- Analyst Convergence: ${(convergenceResult.convergence * 100).toFixed(0)}% ${convergenceResult.convergence > 0.85 ? "⚠️ HIGH — possible groupthink" : "✓ healthy diversity"}
- Healthy Disagreements: ${convergenceResult.healthyDisagreementCount} analysts diverge significantly

${userInjection ? `## User Injection\n${userInjection}\n` : ""}
## Your Task
Evaluate whether you AGREE, DISAGREE, or see NUANCE in the analysts' combined assessment.
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
      const { text } = await invokeAgent({
        systemPrompt: `You are ${getHermesDisplayName(agentRole)}, a P.I.C. Hermes agent. Evaluate the MiroShark market analysis from your perspective as a ${getHermesRole(agentRole)}.`,
        userPrompt: deliberationPrompt,
        model: { temperature: 0.3, maxTokens: 512 },
      });

      const parsed = parseJsonSafe<{
        verdict: string;
        reasoning: string;
        confidence: number;
      }>(text);
      if (!parsed) {
        return {
          agentId: agentRole,
          name: getHermesDisplayName(agentRole),
          verdict: "nuance" as const,
          reasoning: "Unable to parse deliberation response.",
          confidence: 0.3,
        };
      }

      return {
        agentId: agentRole,
        name: getHermesDisplayName(agentRole),
        verdict: (parsed.verdict === "agree" || parsed.verdict === "disagree"
          ? parsed.verdict
          : "nuance") as "agree" | "disagree" | "nuance",
        reasoning: parsed.reasoning ?? "",
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
      };
    }),
  );

  const fulfilled: HermesDeliberation[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") fulfilled.push(r.value);
  }
  return fulfilled;
}

function getHermesDisplayName(role: HermesAgentRole): string {
  const names: Record<string, string> = {
    "pma-merged": "Oracle",
    "futures-desk": "Feucht",
    "fundamentals-desk": "Consul",
    herald: "Herald",
  };
  return names[role] ?? role;
}

function getHermesRole(role: HermesAgentRole): string {
  const roles: Record<string, string> = {
    "pma-merged": "prediction market analyst and macro oracle",
    "futures-desk": "futures execution specialist",
    "fundamentals-desk": "fundamental equity analyst",
    herald: "news sentiment and social signal analyst",
  };
  return roles[role] ?? "analyst";
}

function getMajorityPosition(report: MiroSharkReport): string {
  const votes = report.agentVotes;
  const highVol = votes.filter((v) => v.position === "high-vol").length;
  const lowVol = votes.filter((v) => v.position === "low-vol").length;
  if (highVol > votes.length / 2) return "high-vol";
  if (lowVol > votes.length / 2) return "low-vol";
  return "mixed";
}

// ── Phase 3: Harper-Opus Scoring (upgraded with consensus score) ────────────

async function runHarperScoring(
  report: MiroSharkReport,
  analystAssessments: MarketAnalystAssessment[],
  govAssessments: GovOfficialAssessment[] | null,
  hermesResults: HermesDeliberation[],
  convergenceResult: ConvergenceResult,
  contrarianTriggered: boolean,
  userInjection?: string,
): Promise<HarperOpusScoring> {
  const hermesAgree = hermesResults.filter((h) => h.verdict === "agree").length;
  const hermesDisagree = hermesResults.filter(
    (h) => h.verdict === "disagree",
  ).length;
  const isContested =
    hermesDisagree >= 2 || hermesAgree < hermesResults.length / 2;

  // Build rich analyst summary for Harper
  const analystSection = analystAssessments
    .map(
      (a) =>
        `**${a.name} (${a.title})**: IV ${a.projectedIVScore.toFixed(1)}, Concern: ${a.keyConcern}\n  Reasoning: ${a.assessment}`,
    )
    .join("\n");

  const govSection = govAssessments
    ? `\n## Gov Officials (geopolitical layer)\n${govAssessments.map((a) => `${a.name}: ${a.keyConcern} → ${a.recommendedAction}`).join("\n")}`
    : "";

  const scoringPrompt = `You are Harper-Opus, the Chief Agentic Officer scoring a MiroShark deliberation.

## Phase 1: Market Analyst Assessments
${analystSection}

Convergence: ${(convergenceResult.convergence * 100).toFixed(0)}%${convergenceResult.shouldTriggerContrarian ? " ⚠️ GROUPTHINK RISK — devil's advocate was triggered" : ""}
Healthy Disagreements: ${convergenceResult.healthyDisagreementCount} analysts
${govSection}

## Phase 2: Hermes Deliberation
${hermesResults.map((h) => `${h.name}: ${h.verdict.toUpperCase()} — ${h.reasoning} (confidence: ${(h.confidence * 100).toFixed(0)}%)`).join("\n")}
Consensus: ${isContested ? "CONTESTED — Hermes agents disagree with majority" : "ALIGNED — Hermes agents largely agree"}

${userInjection ? `## User Injection\n${userInjection}\n` : ""}
## Category Scores
${report.categoryScores.map((c) => `${c.category}: ${c.ivScore.toFixed(1)} (conf ${(c.confidence * 100).toFixed(0)}%)`).join("\n")}

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

  const { text } = await invokeAgent({
    systemPrompt:
      "You are Harper-Opus, the Chief Agentic Officer of Priced In Capital. You make the final call on which market theses to surface, which to downgrade, and how to score the combined intelligence from market analysts and Hermes agents. Be decisive. Think like a PM running a book.",
    userPrompt: scoringPrompt,
    model: { temperature: 0.3, maxTokens: 1024 },
  });

  const parsed = parseJsonSafe<HarperOpusScoring>(text);

  const consensusScore = computeConsensusScore(
    analystAssessments,
    hermesResults,
    convergenceResult,
    contrarianTriggered,
  );

  if (!parsed) {
    return {
      compositeIV: report.nextSessionProjection,
      regimeShiftProbability: report.regimeShiftProbability,
      categoryScores: report.categoryScores,
      surfacedTheses: report.scenarios.slice(0, 2).map((s) => s.label),
      downgradedTheses: [],
      contestedTheses: isContested
        ? ["Overall thesis is contested by Hermes agents"]
        : [],
      actionabilityScore: report.confidence * 10,
      finalBriefing:
        "Harper-Opus scoring failed to parse. Falling back to raw analyst results.",
      consensusScore,
      healthyDisagreementCount: convergenceResult.healthyDisagreementCount,
      contrarianTriggered,
    };
  }

  return {
    compositeIV: Math.max(
      0,
      Math.min(10, parsed.compositeIV ?? report.nextSessionProjection),
    ),
    regimeShiftProbability: Math.max(
      0,
      Math.min(
        1,
        parsed.regimeShiftProbability ?? report.regimeShiftProbability,
      ),
    ),
    categoryScores: parsed.categoryScores?.length
      ? parsed.categoryScores
      : report.categoryScores,
    surfacedTheses: parsed.surfacedTheses ?? [],
    downgradedTheses: parsed.downgradedTheses ?? [],
    contestedTheses: parsed.contestedTheses ?? [],
    actionabilityScore: Math.max(
      0,
      Math.min(10, parsed.actionabilityScore ?? 5),
    ),
    finalBriefing: parsed.finalBriefing ?? "",
    consensusScore,
    healthyDisagreementCount: convergenceResult.healthyDisagreementCount,
    contrarianTriggered,
  };
}

// ── Full Deliberation Pipeline (v2 — 4 phases) ─────────────────────────────

export async function runDeliberationPipeline(
  simId: string,
  report: MiroSharkReport,
): Promise<DeliberationState> {
  const state: DeliberationState = {
    simulationId: simId,
    phase: "market-analysts",
    phaseStartedAt: new Date().toISOString(),
  };
  activeDeliberations.set(simId, state);

  try {
    // Phase 1: Extract market analyst assessments (full reasoning, not one-liners)
    const analystAssessments = extractAnalystAssessments(report);

    // Anti-groupthink: detect convergence among analysts
    const convergence = detectConvergence(analystAssessments);
    let contrarianTriggered = false;

    if (
      convergence.shouldTriggerContrarian &&
      convergence.lowestConfidenceAgent
    ) {
      console.log(
        `[MiroShark Deliberation] Convergence ${(convergence.convergence * 100).toFixed(0)}% — triggering devil's advocate on ${convergence.lowestConfidenceAgent}`,
      );
      contrarianTriggered = true;
      // Mark the lowest-confidence analyst as the contrarian
      const contrarian = analystAssessments.find(
        (a) => a.agentId === convergence.lowestConfidenceAgent,
      );
      if (contrarian) {
        contrarian.assessment = `[CONTRARIAN] ${contrarian.assessment} — NOTE: high analyst convergence detected, this assessment may underweight tail risks.`;
      }
    }

    // Phase 1.5: Gov official assessments (conditional — only if geopolitical content)
    let govAssessments: GovOfficialAssessment[] | null = null;
    const govReport = report.govOfficialReport;
    if (govReport) {
      updatePhase(simId, "gov-officials", {
        analystResults: analystAssessments,
      });
      govAssessments = extractGovAssessments(govReport);
      updatePhase(simId, "hermes-deliberation", {
        mirosharkResults: govAssessments,
      });
    } else {
      updatePhase(simId, "hermes-deliberation", {
        analystResults: analystAssessments,
        govOfficialsSkipped: true,
      });
    }

    // Check for user interrupt before Phase 2
    const currentState = activeDeliberations.get(simId)!;
    if (currentState.phase === "interrupted") return currentState;

    // Phase 2: Hermes deliberation (with FULL analyst reasoning, not one-line summaries)
    const hermesResults = await runHermesDeliberation(
      analystAssessments,
      govAssessments,
      report,
      convergence,
      currentState.userInjection,
    );
    updatePhase(simId, "harper-scoring", { hermesResults });

    // Check for user interrupt before Phase 3
    const stateAfterHermes = activeDeliberations.get(simId)!;
    if (stateAfterHermes.phase === "interrupted") return stateAfterHermes;

    // Phase 3: Harper-Opus scoring (with consensus score and convergence data)
    const harperScoring = await runHarperScoring(
      report,
      analystAssessments,
      govAssessments,
      hermesResults,
      convergence,
      contrarianTriggered,
      stateAfterHermes.userInjection,
    );
    updatePhase(simId, "complete", { harperScoring });

    return activeDeliberations.get(simId)!;
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Deliberation pipeline failed";
    console.error("[MiroShark Deliberation]", msg);
    updatePhase(simId, "complete", { error: msg });
    return activeDeliberations.get(simId)!;
  }
}

/** Inject a user take into an active deliberation (pauses before next phase) */
export function injectUserTake(simId: string, take: string): boolean {
  const state = activeDeliberations.get(simId);
  if (!state || state.phase === "complete" || state.phase === "idle")
    return false;

  state.userInjection = take;
  return true;
}

// ── Utilities ───────────────────────────────────────────────────────────────

function parseJsonSafe<T>(text: string): T | null {
  try {
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
