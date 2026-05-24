/**
 * Debate Protocol Service
 * Orchestrates debate between Bullish and Bearish researchers
 * Phase 6 - Day 23
 */

import { invokeAgent } from "../strands/index.js";
import { sql, isDatabaseAvailable } from "../../config/database.js";
import type {
  DebateResult,
  DebateRound,
  ResearcherReport,
  Sentiment,
  DebateRow,
} from "../../types/agents.js";

const MAX_DEBATE_ROUNDS = 3;

const MODERATOR_SYSTEM_PROMPT = `You are a debate moderator for a trading desk. Your job is to:
1. Facilitate one round of debate between bullish and bearish researchers
2. Have each side present their strongest argument
3. Have each side rebut the other's argument
4. Score who won the round (-1 for bear, +1 for bull, 0 for tie)

Return JSON:
{
  "bullishArgument": "string",
  "bearishRebuttal": "string",
  "bearishArgument": "string",
  "bullishRebuttal": "string",
  "roundScore": number (-1 to +1)
}`;

const CONSENSUS_SYSTEM_PROMPT = `You are a senior trading strategist synthesizing a debate between bull and bear researchers.

Given the debate rounds and original research, determine the final recommendation.

Return JSON:
{
  "recommendation": "bullish" | "bearish" | "neutral",
  "confidence": number (0-100),
  "reasoning": "2-3 sentence synthesis of the debate outcome",
  "keyRisks": ["array of risks regardless of direction"]
}`;

export interface DebateInput {
  bullishReport: ResearcherReport;
  bearishReport: ResearcherReport;
  analystReportIds: string[];
}

/**
 * Run the debate protocol
 */
export async function runDebate(
  userId: string,
  input: DebateInput,
): Promise<DebateResult> {
  const startTime = Date.now();
  const debateRounds: DebateRound[] = [];

  // Run debate rounds
  for (let round = 1; round <= MAX_DEBATE_ROUNDS; round++) {
    const previousRounds = debateRounds.map((r) => ({
      bullish: r.bullishArgument,
      bearish: r.bearishArgument,
    }));

    const roundResult = await runDebateRound(
      round,
      input.bullishReport,
      input.bearishReport,
      previousRounds,
    );

    debateRounds.push(roundResult);
  }

  // Calculate consensus score from rounds
  const consensusScore =
    debateRounds.reduce((sum, r) => sum + r.roundScore, 0) / MAX_DEBATE_ROUNDS;

  // Generate final assessment
  const finalAssessment = await generateFinalAssessment(
    input.bullishReport,
    input.bearishReport,
    debateRounds,
    consensusScore,
  );

  const result: DebateResult = {
    id: crypto.randomUUID(),
    userId,
    analystReportIds: input.analystReportIds,
    bullishReport: input.bullishReport,
    bearishReport: input.bearishReport,
    debateRounds,
    consensusScore,
    finalAssessment,
    model: "strands-deepseek",
    totalLatencyMs: Date.now() - startTime,
    createdAt: new Date().toISOString(),
  };

  // Save to database
  await saveDebate(result);

  return result;
}

/**
 * Run a single debate round
 */
async function runDebateRound(
  round: number,
  bullish: ResearcherReport,
  bearish: ResearcherReport,
  previousRounds: { bullish: string; bearish: string }[],
): Promise<DebateRound> {
  const prompt = buildRoundPrompt(round, bullish, bearish, previousRounds);

  const { text } = await invokeAgent({
    systemPrompt: MODERATOR_SYSTEM_PROMPT,
    userPrompt: prompt,
    model: { temperature: 0.4, maxTokens: 1024 },
  });

  const parsed = parseJsonSafe<Omit<DebateRound, "round">>(text);

  return {
    round,
    bullishArgument:
      parsed?.bullishArgument ?? "Bullish case stands on strong technicals.",
    bearishRebuttal:
      parsed?.bearishRebuttal ?? "Technical strength may be overextended.",
    bearishArgument:
      parsed?.bearishArgument ?? "Risk factors outweigh potential upside.",
    bullishRebuttal:
      parsed?.bullishRebuttal ?? "Risks are priced in, upside remains.",
    roundScore: parsed?.roundScore ?? 0,
  };
}

/**
 * Build prompt for a debate round
 */
function buildRoundPrompt(
  round: number,
  bullish: ResearcherReport,
  bearish: ResearcherReport,
  previousRounds: { bullish: string; bearish: string }[],
): string {
  const sections: string[] = [`DEBATE ROUND ${round} OF ${MAX_DEBATE_ROUNDS}`];

  sections.push("\n=== BULL THESIS ===");
  sections.push(bullish.thesis);
  sections.push(`Conviction: ${bullish.conviction}%`);
  sections.push("Key arguments:");
  bullish.keyArguments.slice(0, 3).forEach((arg) => {
    sections.push(`- ${arg.point} (strength: ${arg.strength}/10)`);
  });

  sections.push("\n=== BEAR THESIS ===");
  sections.push(bearish.thesis);
  sections.push(`Conviction: ${bearish.conviction}%`);
  sections.push("Key arguments:");
  bearish.keyArguments.slice(0, 3).forEach((arg) => {
    sections.push(`- ${arg.point} (strength: ${arg.strength}/10)`);
  });

  if (previousRounds.length > 0) {
    sections.push("\n=== PREVIOUS ROUNDS ===");
    previousRounds.forEach((r, i) => {
      sections.push(`Round ${i + 1}:`);
      sections.push(`Bull: ${r.bullish}`);
      sections.push(`Bear: ${r.bearish}`);
    });
    sections.push(
      "\nIn this round, focus on NEW arguments not covered before.",
    );
  }

  sections.push(
    "\nConduct round " + round + ". Have each side present and rebut.",
  );

  return sections.join("\n");
}

/**
 * Generate final assessment from debate
 */
async function generateFinalAssessment(
  bullish: ResearcherReport,
  bearish: ResearcherReport,
  rounds: DebateRound[],
  consensusScore: number,
): Promise<DebateResult["finalAssessment"]> {
  const prompt = buildConsensusPrompt(bullish, bearish, rounds, consensusScore);

  const { text } = await invokeAgent({
    systemPrompt: CONSENSUS_SYSTEM_PROMPT,
    userPrompt: prompt,
    model: { temperature: 0.3, maxTokens: 512 },
  });

  const parsed = parseJsonSafe<{
    recommendation: Sentiment;
    confidence: number;
    reasoning: string;
    keyRisks: string[];
  }>(text);

  return {
    recommendation:
      parsed?.recommendation ??
      (consensusScore > 0.2
        ? "bullish"
        : consensusScore < -0.2
          ? "bearish"
          : "neutral"),
    confidence: parsed?.confidence ?? 50,
    reasoning: parsed?.reasoning ?? "Debate resulted in balanced assessment.",
    keyRisks: parsed?.keyRisks ?? [],
  };
}

/**
 * Build prompt for consensus generation
 */
function buildConsensusPrompt(
  bullish: ResearcherReport,
  bearish: ResearcherReport,
  rounds: DebateRound[],
  consensusScore: number,
): string {
  const sections: string[] = [
    "Synthesize the debate and provide final recommendation.",
  ];

  sections.push(
    `\nConsensus Score: ${consensusScore.toFixed(2)} (negative=bear, positive=bull)`,
  );

  sections.push("\n=== DEBATE SUMMARY ===");
  rounds.forEach((r) => {
    sections.push(
      `Round ${r.round}: Score ${r.roundScore > 0 ? "+" : ""}${r.roundScore.toFixed(1)}`,
    );
    sections.push(`  Bull argued: ${r.bullishArgument.slice(0, 100)}...`);
    sections.push(`  Bear argued: ${r.bearishArgument.slice(0, 100)}...`);
  });

  sections.push(`\nBull price target: ${bullish.priceTarget?.value ?? "N/A"}`);
  sections.push(`Bear price target: ${bearish.priceTarget?.value ?? "N/A"}`);

  sections.push("\nProvide final recommendation for the trading desk.");

  return sections.join("\n");
}

/**
 * Save debate to database
 */
async function saveDebate(result: DebateResult): Promise<void> {
  if (!isDatabaseAvailable() || !sql) {
    return; // Skip in dev mode without DB
  }

  await sql`
    INSERT INTO researcher_debates (
      id, user_id, analyst_report_ids, bullish_report, bearish_report,
      debate_rounds, consensus_score, final_assessment, model, total_latency_ms
    )
    VALUES (
      ${result.id},
      ${result.userId},
      ${result.analystReportIds},
      ${JSON.stringify(result.bullishReport)}::jsonb,
      ${JSON.stringify(result.bearishReport)}::jsonb,
      ${JSON.stringify(result.debateRounds)}::jsonb,
      ${result.consensusScore},
      ${JSON.stringify(result.finalAssessment)}::jsonb,
      ${result.model ?? null},
      ${result.totalLatencyMs ?? null}
    )
  `;
}

/**
 * Get recent debates for user
 */
export async function getDebates(
  userId: string,
  limit = 5,
): Promise<DebateResult[]> {
  if (!isDatabaseAvailable() || !sql) {
    return [];
  }

  const result = await sql`
    SELECT * FROM researcher_debates
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return result.map(mapRowToDebate);
}

/**
 * Map database row to DebateResult
 */
function mapRowToDebate(row: DebateRow): DebateResult {
  return {
    id: row.id,
    userId: row.user_id,
    analystReportIds: row.analyst_report_ids,
    bullishReport: row.bullish_report as unknown as ResearcherReport,
    bearishReport: row.bearish_report as unknown as ResearcherReport,
    debateRounds: row.debate_rounds,
    consensusScore: row.consensus_score ?? 0,
    finalAssessment: row.final_assessment as DebateResult["finalAssessment"],
    model: row.model ?? undefined,
    totalLatencyMs: row.total_latency_ms ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Safe JSON parse
 */
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
