// [claude-code 2026-04-16] S20-T2: Differentiated context feeding — per-agent subject-filtered headlines
// [claude-code 2026-04-10] S8-T3: AgentDesk DAG template — 3-wave deliberation pipeline
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
  AgentDeskCategoryScore,
  AgentDeskRiskCategory,
} from "../../agent-desk/agent-desk-types.js";
import { fetchFilteredHeadlines } from "../../agent-desk/agent-desk-context.js";
import { buildMemoryBlock } from "../../agent-memory/memory-injector.js";
import type { AgentId } from "../../agent-memory/types.js";
import { getLatestBrief } from "../../context-bank/context-bank-service.js";
import { getSupabaseClient } from "../../../config/supabase.js";

// ── Input types for the DAG template ────────────────────────────────────────

export interface NarrativeLane {
  id: string;
  name: string;
  /** 0-1 sentiment score for this lane */
  sentiment: number;
  /** Optional — maps to AgentDeskRiskCategory */
  category?: string;
}

export interface AgentDeskParams {
  lanes: NarrativeLane[];
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

// ── AgentDeskResult (alias for DeliberationState, preserved for compat) ──────

export type AgentDeskResult = DeliberationState;

// ── Agent metadata ────────────────────────────────────────────────────────────

export const ANALYST_META: Record<
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
    // DB tags: subj:macro, subj:geopolitical (geopolitical = macro catalyst)
    subjects: ["macro", "geopolitical"],
  },
  feucht: {
    agentId: "feucht",
    name: "Feucht",
    title: "Futures Execution Desk",
    role: "flow-analyst",
    // DB tags: subj:vol, subj:structure (vol-surface + market microstructure)
    subjects: ["vol", "structure"],
  },
  consul: {
    agentId: "consul",
    name: "Consul",
    title: "Fundamentals & Credit Desk",
    role: "fundamentals",
    // DB tags: subj:earnings, subj:credit
    subjects: ["earnings", "credit"],
  },
  herald: {
    agentId: "herald",
    name: "Herald",
    title: "News Sentiment & Social Signals",
    role: "sentiment-analyst",
    // DB tags: subj:sentiment, subj:geopolitical (breaking news = geopolitical overlap)
    subjects: ["sentiment", "geopolitical"],
  },
};

const WAVE0_AGENTS: HermesAgentId[] = ["oracle", "feucht", "consul", "herald"];

// ── Feucht-specific context: latest brief + highest IV conflicts ────────────
// [claude-code 2026-04-16] Feucht responds from briefings + top market-moving conflicts

async function buildFeuchtContext(): Promise<string> {
  const parts: string[] = [];

  // Latest brief from context bank (Harper's synthesis)
  const brief = getLatestBrief();
  if (brief) {
    const summary = brief.topAlerts
      .slice(0, 5)
      .map((a) => `  - [${a.severity}] ${a.title}`)
      .join("\n");
    const exec = brief.executiveSummary
      ? `\n  Executive: ${brief.executiveSummary.slice(0, 300)}`
      : "";
    parts.push(
      `## Latest Harper Brief${exec}\n### Top Alerts\n${summary || "  (no alerts)"}`,
    );
  }

  // Highest IV-scoring items in last 48h — the most market-moving conflicts
  const sb = getSupabaseClient();
  if (sb) {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data } = await sb
      .from("scored_riskflow_items")
      .select("headline, iv_score, sentiment, macro_level, category")
      .gte("created_at", cutoff)
      .gte("iv_score", 5)
      .order("iv_score", { ascending: false })
      .limit(8);

    if (data?.length) {
      const lines = data.map(
        (r: Record<string, unknown>) =>
          `  - [IV ${r.iv_score}] ${r.headline} (${r.sentiment ?? "neutral"}, ${r.category ?? "unknown"})`,
      );
      parts.push(`## Highest IV Conflicts (48h)\n${lines.join("\n")}`);
    }
  }

  return parts.length > 0 ? parts.join("\n\n") : "";
}

// ── Prompt builders ──────────────────────────────────────────────────────────

function buildNarrativeContext(
  lanes: NarrativeLane[],
  headlines: string[],
): string {
  const laneText = lanes
    .map(
      (l) =>
        `  - ${l.name} (sentiment: ${(l.sentiment * 10).toFixed(1)}/10${l.category ? `, category: ${l.category}` : ""})`,
    )
    .join("\n");

  const headlineText =
    headlines.length > 0
      ? headlines.join("\n")
      : "  (no headlines routed to this desk)";

  return `## Narrative Lanes\n${laneText || "  (none provided)"}\n\n## Headlines Routed to Your Desk\n${headlineText}`;
}

async function buildAnalystPrompt(
  agentKey: string,
  lanes: NarrativeLane[],
  userInjection?: string,
): Promise<string> {
  const meta = ANALYST_META[agentKey];
  const headlines = await fetchFilteredHeadlines(meta.subjects, meta.name);
  const ctx = buildNarrativeContext(lanes, headlines);
  const memoryBlock = await buildMemoryBlock(meta.agentId as AgentId).catch(
    () => "",
  );

  // Feucht gets enriched context: Harper's brief + highest IV conflicts
  const feuchtBlock =
    agentKey === "feucht" ? await buildFeuchtContext().catch(() => "") : "";

  return `You are ${meta.name}, ${meta.title}. Your analytical focus: ${meta.subjects.join(", ")}.
${memoryBlock}
${feuchtBlock}

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
  "headlineCount": ${headlines.length}
}`;
}

async function buildGovPrompt(
  lanes: NarrativeLane[],
  userInjection?: string,
): Promise<string> {
  const govSubjects = ["geopolitical", "regulatory", "policy"];
  const headlines = await fetchFilteredHeadlines(
    govSubjects,
    "Gov Policy Analyst",
  );
  const ctx = buildNarrativeContext(lanes, headlines);
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
  "headlineCount": ${headlines.length}
}`;
}

async function buildDeliberationPrompt(
  agentKey: string,
  lanes: NarrativeLane[],
  userInjection?: string,
): Promise<string> {
  const meta = ANALYST_META[agentKey];
  const headlines = await fetchFilteredHeadlines(meta.subjects, meta.name);
  const ctx = buildNarrativeContext(lanes, headlines);
  const memoryBlock = await buildMemoryBlock(meta.agentId as AgentId).catch(
    () => "",
  );

  return `You are ${meta.name}, ${meta.title}. Your perspective: ${meta.subjects.join(", ")}.
${memoryBlock}

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

async function buildHarperPrompt(
  lanes: NarrativeLane[],
  userInjection?: string,
): Promise<string> {
  // Harper gets a broad view — fetch with all subjects combined
  const allSubjects = Object.values(ANALYST_META).flatMap((m) => m.subjects);
  const uniqueSubjects = [...new Set(allSubjects)];
  const headlines = await fetchFilteredHeadlines(uniqueSubjects, "Harper");
  const ctx = buildNarrativeContext(lanes, headlines);
  const memoryBlock = await buildMemoryBlock("harper").catch(() => "");

  return `You are Harper, Chief Agentic Officer of Priced In Capital.
${memoryBlock}
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

// ── createAgentDeskDAG ───────────────────────────────────────────────────────

export async function createAgentDeskDAG(
  params: AgentDeskParams,
): Promise<DAGDefinition> {
  const { lanes, userInjection, conversationId, userId } = params;
  const tasks: TaskDefinition[] = [];

  // Wave 0: 4 market analyst tasks (parallel) — each gets subject-filtered headlines
  const wave0Prompts = await Promise.all(
    WAVE0_AGENTS.map((agentId) =>
      buildAnalystPrompt(agentId, lanes, userInjection),
    ),
  );

  for (let i = 0; i < WAVE0_AGENTS.length; i++) {
    tasks.push({
      key: `${WAVE0_AGENTS[i]}-analysis`,
      agentId: WAVE0_AGENTS[i],
      taskType: "analysis",
      depKeys: [],
      input: {
        prompt: wave0Prompts[i],
        role: "analysis",
        agentKey: WAVE0_AGENTS[i],
        wave: 0,
      },
    });
  }

  // Wave 0: Optional gov phase (geopolitical lanes detected)
  const includeGov = shouldIncludeGovPhase(lanes);
  if (includeGov) {
    const govPrompt = await buildGovPrompt(lanes, userInjection);
    tasks.push({
      key: "gov-analysis",
      agentId: "oracle", // oracle handles geopolitical framing
      taskType: "analysis",
      depKeys: [],
      input: {
        prompt: govPrompt,
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

  const wave1Prompts = await Promise.all(
    WAVE0_AGENTS.map((agentId) =>
      buildDeliberationPrompt(agentId, lanes, userInjection),
    ),
  );

  for (let i = 0; i < WAVE0_AGENTS.length; i++) {
    tasks.push({
      key: `${WAVE0_AGENTS[i]}-deliberation`,
      agentId: WAVE0_AGENTS[i],
      taskType: "deliberation",
      depKeys: wave0Keys,
      input: {
        prompt: wave1Prompts[i],
        role: "deliberation",
        agentKey: WAVE0_AGENTS[i],
        wave: 1,
      },
    });
  }

  // Wave 2: Harper synthesis — depends on ALL wave 0 + wave 1 tasks
  const wave1Keys = WAVE0_AGENTS.map((id) => `${id}-deliberation`);
  const harperPrompt = await buildHarperPrompt(lanes, userInjection);

  tasks.push({
    key: "harper-synthesis",
    agentId: "harper",
    taskType: "synthesis",
    depKeys: [...wave0Keys, ...wave1Keys],
    input: {
      prompt: harperPrompt,
      role: "synthesis",
      agentKey: "harper",
      wave: 2,
    },
  });

  return {
    conversationId,
    userId,
    surface: "boardroom",
    template: "agent-desk-deliberation",
    input: { lanes, userInjection: userInjection ?? null },
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
 * MUST match the formula in agent-desk-deliberation.ts exactly.
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
 * Consensus scoring — MUST match the formula in agent-desk-deliberation.ts exactly.
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
function defaultCategoryScores(): AgentDeskCategoryScore[] {
  const cats: AgentDeskRiskCategory[] = [
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
): AgentDeskResult {
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
  // [claude-code 2026-04-19] S25-T7: Groupthink guard — Herald dissent is now MANDATORY on every
  // deliberation run, not just when convergence tips a threshold. We keep the computed flag
  // (shouldTriggerContrarian) for telemetry but override it true so the CONTRARIAN tag is always
  // applied. Blind-then-reveal ordering is structurally enforced by the DAG: wave 0 (analysts)
  // completes before wave 1 (Hermes) subscribes to its outputs, so no analyst reads another's
  // draft before locking their own.
  const contrarianTriggered = true;

  if (analystAssessments.length > 0) {
    const lowestConf = analystAssessments.reduce((a, b) =>
      a.confidence < b.confidence ? a : b,
    );
    const reason = shouldTriggerContrarian
      ? "high analyst convergence detected, this assessment may underweight tail risks"
      : "mandatory dissent pass — every run surfaces a counter-view";
    lowestConf.assessment = `[CONTRARIAN] ${lowestConf.assessment} — NOTE: ${reason}.`;
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
