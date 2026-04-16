// [claude-code 2026-04-16] S20-T3: Oracle arb detector — cross-references prediction
// market contracts with RiskFlow scored items and IV scoring to find mismatches.

import { createLogger } from "../../lib/logger.js";
import { getFeed } from "../riskflow/feed-service.js";
import { getRecentDivergenceAlerts } from "../polymarket-kalshi-divergence.js";
import { invokeAgent } from "../strands/invoke-helper.js";
import type { ScannedContract, OracleResearchFinding } from "./types.js";
import { ORACLE_SUBJECTS } from "./types.js";

const log = createLogger("OracleArbDetector");

/** Mismatch threshold — flag when market-implied vs IV-derived probability differ by >15% */
const ARB_THRESHOLD = 0.15;

const SYSTEM_PROMPT = `You are Oracle, Priced In Capital's prediction market specialist.
You analyze prediction market contracts alongside RiskFlow scored intelligence to find
arbitrage opportunities and market signals. Be precise, quantitative, and contrarian.
Format: 2-3 paragraph analysis with specific probability assessments and trade thesis.`;

/**
 * Cross-reference scanned contracts with RiskFlow themes + divergence alerts.
 * Returns findings ready for storage.
 */
export async function detectArbOpportunities(
  contracts: ScannedContract[],
): Promise<OracleResearchFinding[]> {
  if (contracts.length === 0) return [];

  const [feedResponse, divergenceAlerts] = await Promise.all([
    getFeed("system").catch(() => ({ items: [], total: 0 })),
    Promise.resolve(getRecentDivergenceAlerts()),
  ]);

  const scoredItems = feedResponse.items ?? [];
  const findings: OracleResearchFinding[] = [];

  // 1. Process existing divergence alerts (consume, don't duplicate)
  for (const alert of divergenceAlerts) {
    if (alert.divergencePct < ARB_THRESHOLD) continue;

    const matchedThemes = findMatchingThemes(
      alert.polymarketQuestion,
      scoredItems,
    );
    const analysis = await generateAnalysis(
      `Cross-platform divergence: "${alert.polymarketQuestion}" — Polymarket YES ${(alert.polymarketYesPrice * 100).toFixed(1)}% vs Kalshi YES ${(alert.kalshiYesPrice * 100).toFixed(1)}% (${(alert.divergencePct * 100).toFixed(1)}% gap). Direction: ${alert.direction}. Significance: ${alert.significance}. Related RiskFlow themes: ${matchedThemes.join(", ") || "none detected"}.`,
    );

    findings.push({
      finding_type: "arb_opportunity",
      platform: "cross",
      contract_id: `${alert.polymarketSlug}|${alert.kalshiTicker}`,
      contract_title: alert.polymarketQuestion,
      current_price: alert.polymarketYesPrice,
      iv_cross_score: scoreFromDivergence(alert.divergencePct),
      riskflow_correlation: matchedThemes.join(", "),
      analysis,
      confidence: Math.min(0.95, 0.5 + alert.divergencePct),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
    });
  }

  // 2. Score individual contracts against RiskFlow intelligence
  for (const contract of contracts) {
    const matchedThemes = findMatchingThemes(contract.title, scoredItems);
    if (matchedThemes.length === 0) continue;

    const avgIvScore = computeAvgIvScore(contract.title, scoredItems);
    const impliedProb = contract.yesPrice;
    const ivDerivedProb = ivScoreToProb(avgIvScore);

    if (Math.abs(impliedProb - ivDerivedProb) < ARB_THRESHOLD) continue;

    const analysis = await generateAnalysis(
      `Market signal: "${contract.title}" on ${contract.platform} — market-implied ${(impliedProb * 100).toFixed(1)}% vs IV-derived ${(ivDerivedProb * 100).toFixed(1)}% (${(Math.abs(impliedProb - ivDerivedProb) * 100).toFixed(1)}% gap). Category: ${contract.category}. 24h volume: $${contract.volume24h.toLocaleString()}. Related RiskFlow themes: ${matchedThemes.join(", ")}.`,
    );

    findings.push({
      finding_type: "market_signal",
      platform: contract.platform,
      contract_id: contract.contractId,
      contract_title: contract.title,
      current_price: contract.yesPrice,
      iv_cross_score: avgIvScore,
      riskflow_correlation: matchedThemes.join(", "),
      analysis,
      confidence: Math.min(0.95, 0.4 + matchedThemes.length * 0.1),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
    });
  }

  log.info(
    `Detected ${findings.length} findings from ${contracts.length} contracts`,
  );
  return findings;
}

/** Match contract title keywords against scored RiskFlow items (subject-tag matching) */
function findMatchingThemes(
  title: string,
  scoredItems: Array<{ headline: string; tags?: string[]; riskType?: string }>,
): string[] {
  const lower = title.toLowerCase();
  const themes = new Set<string>();

  for (const subject of ORACLE_SUBJECTS) {
    const subjectLower = subject.replace("-", " ");
    if (lower.includes(subjectLower)) themes.add(subject);
  }

  for (const item of scoredItems) {
    const itemText =
      `${item.headline} ${(item.tags ?? []).join(" ")}`.toLowerCase();
    for (const subject of ORACLE_SUBJECTS) {
      if (lower.includes(subject) && itemText.includes(subject)) {
        themes.add(`riskflow:${item.riskType ?? subject}`);
      }
    }
  }

  return [...themes];
}

/** Average IV score of RiskFlow items matching a contract title */
function computeAvgIvScore(
  title: string,
  scoredItems: Array<{ headline: string; ivScore?: number }>,
): number {
  const lower = title.toLowerCase();
  const words = lower.split(/\s+/).filter((w) => w.length > 3);

  const matching = scoredItems.filter((item) => {
    const h = item.headline.toLowerCase();
    return words.some((w) => h.includes(w));
  });

  if (matching.length === 0) return 0;
  const total = matching.reduce((sum, item) => sum + (item.ivScore ?? 0), 0);
  return Math.round((total / matching.length) * 100) / 100;
}

/** Convert IV score (0-10) to approximate probability (0-1) */
function ivScoreToProb(ivScore: number): number {
  return Math.min(0.95, Math.max(0.05, ivScore / 10));
}

/** Convert divergence percentage to a 0-10 IV cross score */
function scoreFromDivergence(divergencePct: number): number {
  return Math.min(10, Math.round(divergencePct * 30 * 100) / 100);
}

async function generateAnalysis(prompt: string): Promise<string> {
  try {
    const result = await invokeAgent({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: prompt,
    });
    return result.text;
  } catch (err) {
    log.warn("Analysis generation failed, using raw prompt", {
      error: String(err),
    });
    return `[Auto-generated] ${prompt}`;
  }
}
