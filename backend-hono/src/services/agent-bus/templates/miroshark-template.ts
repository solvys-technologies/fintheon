// [claude-code 2026-04-10] S8-T3: MiroShark DAG template — 3-wave deliberation pipeline
// Wave 0: 4 analyst tasks (parallel) → Wave 1: 4 deliberation tasks → Wave 2: Harper synthesis

import type {
  DAGDefinition,
  TaskDefinition,
  DAGRecord,
  HermesAgentId,
} from "../types.js";
import type {
  MarketAnalystAssessment,
  HermesDeliberation,
  HarperOpusScoring,
  DeliberationState,
  MiroSharkCategoryScore,
  MiroSharkRiskCategory,
} from "../../miroshark/miroshark-types.js";

// ── Input types for the DAG template ────────────────────────────────────────

export interface NarrativeLane {
  id: string;
  name: string;
  /** 0-1 sentiment score for this lane */
  sentiment: number;
  /** Optional — maps to MiroSharkRiskCategory */
  category?: string;
}

export interface CatalystCard {
  id: string;
  headline: string;
  /** 0-10 severity / impact score */
  severity: number;
  body?: string;
}

export interface MiroSharkParams {
  lanes: NarrativeLane[];
  catalysts: CatalystCard[];
  userInjection?: string;
  conversationId?: string;
  userId?: string;
}

// ── Collected task output (built during execution via bus subscriptions) ─────

export interface CollectedTaskOutput {
  agentId: HermesAgentId;
  wave: number;
  text: string;
}

// ── MiroSharkResult (alias for DeliberationState, preserved for compat) ──────

export type MiroSharkResult = DeliberationState;

// ── Agent metadata ────────────────────────────────────────────────────────────

const ANALYST_META: Record<
  string,
  {
    agentId: HermesAgentId;
    name: string;
    title: string;
    role: string;
    subjects: string[];
  }
> = {
  oracle: {
    agentId: "oracle",
    name: "Oracle",
    title: "Macro Oracle & Prediction Markets",
    role: "macro-strategist",
    subjects: ["macro", "monetary-policy", "prediction-markets", "regime"],
  },
  feucht: {
    agentId: "feucht",
    name: "Feucht",
    title: "Futures Execution Desk",
    role: "flow-analyst",
    subjects: ["futures", "flow", "vol-surface", "positioning"],
  },
  consul: {
    agentId: "consul",
    name: "Consul",
    title: "Fundamentals & Credit Desk",
    role: "fundamentals",
    subjects: ["earnings", "credit", "valuations", "fundamentals"],
  },
  herald: {
    agentId: "herald",
    name: "Herald",
    title: "News Sentiment & Social Signals",
    role: "sentiment-analyst",
    subjects: ["sentiment", "news-flow", "social", "market-structure"],
  },
};

const WAVE0_AGENTS: HermesAgentId[] = ["oracle", "feucht", "consul", "herald"];

// ── Prompt builders ──────────────────────────────────────────────────────────

function buildNarrativeContext(
  lanes: NarrativeLane[],
  catalysts: CatalystCard[],
): string {
  const laneText = lanes
    .map(
      (l) =>
        `  - ${l.name} (sentiment: ${(l.sentiment * 10).toFixed(1)}/10${l.category ? `, category: ${l.category}` : ""})`,
    )
    .join("\n");

  const catalystText = catalysts
    .map(
      (c) =>
        `  - [severity ${c.severity}] ${c.headline}${c.body ? `: ${c.body}` : ""}`,
    )
    .join("\n");

  return `## Narrative Lanes\n${laneText || "  (none provided)"}\n\n## Market Catalysts\n${catalystText || "  (none provided)"}`;
}

function buildAnalystPrompt(
  agentKey: string,
  lanes: NarrativeLane[],
  catalysts: CatalystCard[],
  userInjection?: string,
): string {
  const meta = ANALYST_META[agentKey];
  const ctx = buildNarrativeContext(lanes, catalysts);

  return `You are ${meta.name}, ${meta.title}. Your analytical focus: ${meta.subjects.join(", ")}.

${ctx}
${userInjection ? `\n## Additional Context from User\n${userInjection}\n` : ""}
## Your Task
Analyze the above narrative context from your perspective as ${meta.title}.
Assess the implied volatility (IV) risk and market regime based on these inputs.

Respond with ONLY valid JSON, no markdown fences:
{
  "agentId": "${meta.agentId}",
  "name": "${meta.name}",
  "title": "${meta.title}",
  "role": "${meta.role}",
  "subjects": ${JSON.stringify(meta.subjects)},
  "assessment": "<3-4 sentences of your full reasoning>",
  "confidence": <0.0-1.0>,
  "keyConcern": "<your single most important concern, max 100 chars>",
  "projectedIVScore": <0.0-10.0>,
  "regimeShiftProbability": <0.0-1.0>,
  "categoryScores": [
    { "category": "geopolitical", "ivScore": <0-10>, "confidence": <0-1>, "delta": <-5 to 5> },
    { "category": "political", "ivScore": <0-10>, "confidence": <0-1>, "delta": <-5 to 5> },
    { "category": "monetary-policy", "ivScore": <0-10>, "confidence": <0-1>, "delta": <-5 to 5> },
    { "category": "earnings-corporate", "ivScore": <0-10>, "confidence": <0-1>, "delta": <-5 to 5> },
    { "category": "market-structure", "ivScore": <0-10>, "confidence": <0-1>, "delta": <-5 to 5> },
    { "category": "black-swan", "ivScore": <0-10>, "confidence": <0-1>, "delta": <-5 to 5> }
  ],
  "headlineCount": ${catalysts.length}
}`;
}

function buildGovPrompt(
  lanes: NarrativeLane[],
  catalysts: CatalystCard[],
  userInjection?: string,
): string {
  const ctx = buildNarrativeContext(lanes, catalysts);
  const geoPoliticalLanes = lanes
    .filter((l) => l.category === "geopolitical" || l.category === "political")
    .map((l) => l.name)
    .join(", ");

  return `You are a composite government policy analyst covering geopolitical and regulatory risk.
Focus areas: ${geoPoliticalLanes || "geopolitical conditions"}.

${ctx}
${userInjection ? `\n## Additional Context from User\n${userInjection}\n` : ""}
## Your Task
Assess geopolitical and policy risk from a government/regulatory perspective.
What policy actions, tariff changes, or geopolitical events could materially shift the volatility regime?

Respond with ONLY valid JSON:
{
  "agentId": "oracle",
  "name": "Gov Policy Analyst",
  "title": "Geopolitical & Regulatory Risk",
  "role": "geopolitical-analyst",
  "subjects": ["geopolitical", "regulatory", "policy"],
  "assessment": "<3-4 sentences>",
  "confidence": <0-1>,
  "keyConcern": "<max 100 chars>",
  "projectedIVScore": <0-10>,
  "regimeShiftProbability": <0-1>,
  "categoryScores": [
    { "category": "geopolitical", "ivScore": <0-10>, "confidence": <0-1>, "delta": <-5 to 5> },
    { "category": "political", "ivScore": <0-10>, "confidence": <0-1>, "delta": <-5 to 5> },
    { "category": "monetary-policy", "ivScore": <0-10>, "confidence": <0-1>, "delta": <-5 to 5> },
    { "category": "earnings-corporate", "ivScore": <0-10>, "confidence": <0-1>, "delta": <-5 to 5> },
    { "category": "market-structure", "ivScore": <0-10>, "confidence": <0-1>, "delta": <-5 to 5> },
    { "category": "black-swan", "ivScore": <0-10>, "confidence": <0-1>, "delta": <-5 to 5> }
  ],
  "headlineCount": ${catalysts.length}
}`;
}

function buildDeliberationPrompt(
  agentKey: string,
  lanes: NarrativeLane[],
  catalysts: CatalystCard[],
  userInjection?: string,
): string {
  const meta = ANALYST_META[agentKey];
  const ctx = buildNarrativeContext(lanes, catalysts);

  return `You are ${meta.name}, ${meta.title}. Your perspective: ${meta.subjects.join(", ")}.

${ctx}
${userInjection ? `\n## User Injection\n${userInjection}\n` : ""}
## Your Task
A team of market analysts has assessed the above narratives. Based on this market context
and your specialized expertise, evaluate whether the general market consensus is:
- Too complacent (missing tail risk) → DISAGREE
- Appropriately calibrated → AGREE
- Partially correct but missing nuance → NUANCE

Respond with ONLY valid JSON:
{
  "agentId": "${meta.agentId}",
  "name": "${meta.name}",
  "verdict": "agree" | "disagree" | "nuance",
  "reasoning": "<2-3 sentences>",
  "confidence": <0.0-1.0>
}`;
}

function buildHarperPrompt(
  lanes: NarrativeLane[],
  catalysts: CatalystCard[],
  userInjection?: string,
): string {
  const ctx = buildNarrativeContext(lanes, catalysts);

  return `You are Harper-Opus, Chief Agentic Officer of Priced In Capital.

${ctx}
${userInjection ? `\n## User Injection\n${userInjection}\n` : ""}
## Your Task
A team of market analysts and deliberation agents have assessed these narratives.
Make the final call: which theses are actionable, which should be downgraded, which are contested.

Respond with ONLY valid JSON:
{
  "compositeIV": <0-10, final adjusted composite IV>,
  "regimeShiftProbability": <0-1>,
  "categoryScores": [
    { "category": "geopolitical", "ivScore": <0-10>, "confidence": <0-1>, "delta": <-5 to 5> },
    { "category": "political", "ivScore": <0-10>, "confidence": <0-1>, "delta": <-5 to 5> },
    { "category": "monetary-policy", "ivScore": <0-10>, "confidence": <0-1>, "delta": <-5 to 5> },
    { "category": "earnings-corporate", "ivScore": <0-10>, "confidence": <0-1>, "delta": <-5 to 5> },
    { "category": "market-structure", "ivScore": <0-10>, "confidence": <0-1>, "delta": <-5 to 5> },
    { "category": "black-swan", "ivScore": <0-10>, "confidence": <0-1>, "delta": <-5 to 5> }
  ],
  "surfacedTheses": ["<actionable thesis 1>", "<actionable thesis 2>"],
  "downgradedTheses": ["<thesis to ignore>"],
  "contestedTheses": ["<thesis with disagreement>"],
  "actionabilityScore": <0-10>,
  "finalBriefing": "<3-5 sentence executive summary>"
}`;
}

// ── shouldIncludeGovPhase ────────────────────────────────────────────────────

export function shouldIncludeGovPhase(lanes: NarrativeLane[]): boolean {
  return lanes.some(
    (l) => l.category === "geopolitical" || l.category === "political",
  );
}

// ── createMiroSharkDAG ───────────────────────────────────────────────────────

export function createMiroSharkDAG(params: MiroSharkParams): DAGDefinition {
  const { lanes, catalysts, userInjection, conversationId, userId } = params;
  const tasks: TaskDefinition[] = [];

  // Wave 0: 4 market analyst tasks (parallel)
  for (const agentId of WAVE0_AGENTS) {
    tasks.push({
      key: `${agentId}-analysis`,
      agentId,
      taskType: "analysis",
      depKeys: [],
      input: {
        prompt: buildAnalystPrompt(agentId, lanes, catalysts, userInjection),
        role: "analysis",
        agentKey: agentId,
        wave: 0,
      },
    });
  }

  // Wave 0: Optional gov phase (geopolitical lanes detected)
  const includeGov = shouldIncludeGovPhase(lanes);
  if (includeGov) {
    tasks.push({
      key: "gov-analysis",
      agentId: "oracle", // oracle handles geopolitical framing
      taskType: "analysis",
      depKeys: [],
      input: {
        prompt: buildGovPrompt(lanes, catalysts, userInjection),
        role: "gov-analysis",
        agentKey: "gov",
        wave: 0,
      },
    });
  }

  // Wave 1: 4 deliberation tasks — depend on ALL wave 0 tasks
  const wave0Keys = [
    "oracle-analysis",
    "feucht-analysis",
    "consul-analysis",
    "herald-analysis",
    ...(includeGov ? ["gov-analysis"] : []),
  ];

  for (const agentId of WAVE0_AGENTS) {
    tasks.push({
      key: `${agentId}-deliberation`,
      agentId,
      taskType: "deliberation",
      depKeys: wave0Keys,
      input: {
        prompt: buildDeliberationPrompt(
          agentId,
          lanes,
          catalysts,
          userInjection,
        ),
        role: "deliberation",
        agentKey: agentId,
        wave: 1,
      },
    });
  }

  // Wave 2: Harper synthesis — depends on ALL wave 0 + wave 1 tasks
  const wave1Keys = WAVE0_AGENTS.map((id) => `${id}-deliberation`);

  tasks.push({
    key: "harper-synthesis",
    agentId: "harper",
    taskType: "synthesis",
    depKeys: [...wave0Keys, ...wave1Keys],
    input: {
      prompt: buildHarperPrompt(lanes, catalysts, userInjection),
      role: "synthesis",
      agentKey: "harper",
      wave: 2,
    },
  });

  return {
    conversationId,
    userId,
    surface: "boardroom",
    template: "miroshark-deliberation",
    input: { lanes, catalysts, userInjection: userInjection ?? null },
    tasks,
  };
}

// ── Post-processing utilities ────────────────────────────────────────────────

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

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Compute convergence among analyst projectedIVScores.
 * convergence = 1 - (stddev(ivScores) / mean(ivScores))
 * MUST match the formula in miroshark-deliberation.ts exactly.
 */
function computeConvergence(assessments: MarketAnalystAssessment[]): {
  convergence: number;
  shouldTriggerContrarian: boolean;
  healthyDisagreementCount: number;
} {
  if (assessments.length < 2) {
    return {
      convergence: 0,
      shouldTriggerContrarian: false,
      healthyDisagreementCount: 0,
    };
  }

  const ivScores = assessments.map((a) => a.projectedIVScore);
  const mean = ivScores.reduce((s, v) => s + v, 0) / ivScores.length;
  const sd = stddev(ivScores);

  const convergence = mean > 0 ? Math.max(0, Math.min(1, 1 - sd / mean)) : 0;
  const healthyDisagreementCount = ivScores.filter(
    (v) => Math.abs(v - mean) > 1.5,
  ).length;

  return {
    convergence,
    shouldTriggerContrarian: convergence > 0.85,
    healthyDisagreementCount,
  };
}

/**
 * Consensus scoring — MUST match the formula in miroshark-deliberation.ts exactly.
 * base = avgConfidence * 50
 *      + agreeRatio * 25
 *      - disagreeRatio * 20
 *      - (convergence > 0.9 ? 10 : 0)
 *      + (contrarianTriggered ? 5 : 0)
 *      clipped [0-100]
 */
function computeConsensusScore(
  analystAssessments: MarketAnalystAssessment[],
  hermesResults: HermesDeliberation[],
  convergence: number,
  contrarianTriggered: boolean,
): number {
  let score = 0;

  if (analystAssessments.length > 0) {
    const avgConf =
      analystAssessments.reduce((s, a) => s + a.confidence, 0) /
      analystAssessments.length;
    score += avgConf * 50;
  }

  if (hermesResults.length > 0) {
    const agreeCount = hermesResults.filter(
      (h) => h.verdict === "agree",
    ).length;
    const disagreeCount = hermesResults.filter(
      (h) => h.verdict === "disagree",
    ).length;
    const agreeRatio = agreeCount / hermesResults.length;
    const disagreeRatio = disagreeCount / hermesResults.length;
    score += agreeRatio * 25;
    score -= disagreeRatio * 20;
  }

  if (convergence > 0.9) score -= 10;
  if (contrarianTriggered) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Fallback category scores when parsing fails */
function defaultCategoryScores(): MiroSharkCategoryScore[] {
  const cats: MiroSharkRiskCategory[] = [
    "geopolitical",
    "political",
    "monetary-policy",
    "earnings-corporate",
    "market-structure",
    "black-swan",
  ];
  return cats.map((c) => ({
    category: c,
    ivScore: 5,
    confidence: 0.5,
    delta: 0,
  }));
}

// ── postProcessDeliberation ──────────────────────────────────────────────────

/**
 * Parse DAG task outputs and compute convergence/consensus/scoring.
 * Called after executeDag() completes. Collected tasks are gathered
 * via AgentBus subscriptions during execution.
 */
export function postProcessDeliberation(
  dagRecord: DAGRecord,
  collectedOutputs: CollectedTaskOutput[],
  simId: string,
  userInjection?: string,
): MiroSharkResult {
  // ── Wave 0: Extract analyst assessments ──────────────────────────────────
  const wave0Outputs = collectedOutputs.filter((t) => t.wave === 0);
  // Exclude gov-analysis from the main analyst list (it uses agentId 'oracle' twice)
  // We identify gov by checking if its output parses with role "geopolitical-analyst"
  const analystAssessments: MarketAnalystAssessment[] = [];

  for (const out of wave0Outputs) {
    const parsed = parseJsonSafe<MarketAnalystAssessment>(out.text);
    if (parsed?.projectedIVScore !== undefined) {
      // Only add if it's not the gov duplicate (role check)
      if (parsed.role !== "geopolitical-analyst") {
        analystAssessments.push({
          agentId: parsed.agentId ?? out.agentId,
          name: parsed.name ?? out.agentId,
          title: parsed.title ?? out.agentId,
          role: parsed.role ?? "analyst",
          subjects: parsed.subjects ?? [],
          assessment: parsed.assessment ?? "",
          confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
          keyConcern: parsed.keyConcern ?? "",
          projectedIVScore: Math.max(0, Math.min(10, parsed.projectedIVScore)),
          regimeShiftProbability: Math.max(
            0,
            Math.min(1, parsed.regimeShiftProbability ?? 0.5),
          ),
          categoryScores: parsed.categoryScores ?? defaultCategoryScores(),
          headlineCount: parsed.headlineCount ?? 0,
        });
      }
    }
  }

  // ── Convergence detection ─────────────────────────────────────────────────
  const { convergence, shouldTriggerContrarian, healthyDisagreementCount } =
    computeConvergence(analystAssessments);
  const contrarianTriggered = shouldTriggerContrarian;

  // Mark lowest-confidence analyst as contrarian (matches existing logic)
  if (contrarianTriggered && analystAssessments.length > 0) {
    const lowestConf = analystAssessments.reduce((a, b) =>
      a.confidence < b.confidence ? a : b,
    );
    lowestConf.assessment = `[CONTRARIAN] ${lowestConf.assessment} — NOTE: high analyst convergence detected, this assessment may underweight tail risks.`;
  }

  // ── Wave 1: Extract Hermes deliberation results ───────────────────────────
  const wave1Outputs = collectedOutputs.filter((t) => t.wave === 1);
  const hermesResults: HermesDeliberation[] = [];

  for (const out of wave1Outputs) {
    const parsed = parseJsonSafe<{
      agentId?: string;
      name?: string;
      verdict?: string;
      reasoning?: string;
      confidence?: number;
    }>(out.text);

    if (parsed) {
      hermesResults.push({
        agentId: parsed.agentId ?? out.agentId,
        name: parsed.name ?? out.agentId,
        verdict:
          parsed.verdict === "agree" || parsed.verdict === "disagree"
            ? parsed.verdict
            : "nuance",
        reasoning: parsed.reasoning ?? "",
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
      });
    }
  }

  // ── Consensus scoring ─────────────────────────────────────────────────────
  const consensusScore = computeConsensusScore(
    analystAssessments,
    hermesResults,
    convergence,
    contrarianTriggered,
  );

  // ── Wave 2: Extract Harper synthesis ─────────────────────────────────────
  const wave2Output = collectedOutputs.find((t) => t.wave === 2);
  let harperScoring: HarperOpusScoring | undefined;

  if (wave2Output) {
    const parsed = parseJsonSafe<Partial<HarperOpusScoring>>(wave2Output.text);
    if (parsed) {
      harperScoring = {
        compositeIV: Math.max(0, Math.min(10, parsed.compositeIV ?? 5)),
        regimeShiftProbability: Math.max(
          0,
          Math.min(1, parsed.regimeShiftProbability ?? 0.5),
        ),
        categoryScores: parsed.categoryScores?.length
          ? parsed.categoryScores
          : defaultCategoryScores(),
        surfacedTheses: parsed.surfacedTheses ?? [],
        downgradedTheses: parsed.downgradedTheses ?? [],
        contestedTheses: parsed.contestedTheses ?? [],
        actionabilityScore: Math.max(
          0,
          Math.min(10, parsed.actionabilityScore ?? 5),
        ),
        finalBriefing: parsed.finalBriefing ?? "",
        consensusScore,
        healthyDisagreementCount,
        contrarianTriggered,
      };
    }
  }

  // Fallback Harper scoring if wave 2 output missing or unparseable
  if (!harperScoring) {
    harperScoring = {
      compositeIV: 5,
      regimeShiftProbability: 0.5,
      categoryScores: defaultCategoryScores(),
      surfacedTheses: [],
      downgradedTheses: [],
      contestedTheses: [],
      actionabilityScore: 5,
      finalBriefing:
        "DAG synthesis incomplete — fallback to raw analyst results.",
      consensusScore,
      healthyDisagreementCount,
      contrarianTriggered,
    };
  }

  return {
    simulationId: simId,
    phase: dagRecord.status === "failed" ? "complete" : "complete",
    phaseStartedAt: dagRecord.completedAt ?? new Date().toISOString(),
    analystResults: analystAssessments,
    hermesResults,
    harperScoring,
    userInjection,
    error: dagRecord.status === "failed" ? "DAG execution failed" : undefined,
  };
}
